package com.tengzikeji.dagongren;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class CredentialVault {
    private static final String ALIAS = "dagongren.webdav.credentials.v1";
    private final SharedPreferences prefs;
    CredentialVault(Context context) { prefs = context.getSharedPreferences("webdav-vault", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    synchronized JSONObject load() throws Exception {
        String text = prefs.getString("ciphertext", null);
        if (text == null) return null;
        String iv = prefs.getString("iv", null);
        if (iv == null) throw new IllegalStateException("连接配置无法读取，请重新配置。");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(text, Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
    }
    synchronized void save(JSONObject config) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(config.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!prefs.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit())
            throw new IllegalStateException("无法保存连接配置，请检查手机存储。");
    }
    synchronized void clear() { if (!prefs.edit().clear().commit()) throw new IllegalStateException("配置移除失败，请重试。"); }
    static JSONObject publicConfig(JSONObject config) throws Exception {
        JSONObject value = new JSONObject().put("configured", config != null);
        if (config != null) for (String field : new String[]{"url", "username", "path"}) value.put(field, config.getString(field));
        return value;
    }
}
