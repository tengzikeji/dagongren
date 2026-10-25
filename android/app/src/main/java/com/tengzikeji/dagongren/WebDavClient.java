package com.tengzikeji.dagongren;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import okhttp3.Credentials;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONObject;

final class WebDavClient {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient client;
    private final HttpUrl base;
    private final String authorization;
    private final String[] parts;

    WebDavClient(JSONObject config) throws Exception { this(config, secureClient(), false); }
    WebDavClient(JSONObject config, OkHttpClient http, boolean allowTestHttp) throws Exception {
        base = HttpUrl.get(config.getString("url"));
        if ((!base.isHttps() && !allowTestHttp) || !base.username().isEmpty() || !base.password().isEmpty()
            || base.query() != null || base.fragment() != null || !base.encodedPath().endsWith("/"))
            throw new IllegalArgumentException("服务地址必须是以 / 结尾的 HTTPS 地址，不能包含账号、查询参数或片段。");
        String username=config.getString("username"), password=config.getString("password");
        if(username.trim().isEmpty() || password.isEmpty() || username.contains(":")) throw new IllegalArgumentException("请填写正确的账号和专用应用密码。");
        parts=validatePath(config.getString("path"));
        authorization=Credentials.basic(username,password,StandardCharsets.UTF_8);
        client=http;
    }
    static OkHttpClient secureClient() {
        return new OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(45,TimeUnit.SECONDS)
            .writeTimeout(45,TimeUnit.SECONDS).callTimeout(60,TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).build();
    }
    static String[] validatePath(String path) {
        if(path.trim().isEmpty() || path.startsWith("/") || path.contains("\\") || path.length()>250)
            throw new IllegalArgumentException("账本路径应为相对路径，例如：打工人/工资账本.json。");
        String[] parts=path.split("/",-1);
        if(parts.length>5 || !path.endsWith(".json")) throw new IllegalArgumentException("账本路径最多5层，并须以 .json 结尾。");
        for(String part:parts) if(part.trim().isEmpty() || part.equals(".") || part.equals("..") || part.chars().anyMatch(c->c<32))
            throw new IllegalArgumentException("账本路径包含无效目录或文件名。");
        return parts;
    }
    private HttpUrl fileUrl() { HttpUrl.Builder value=base.newBuilder();for(String part:parts)value.addPathSegment(part);return value.build(); }
    private Request.Builder request(HttpUrl url) { return new Request.Builder().url(url).header("Authorization",authorization).header("User-Agent","Dagongren/1.1.0").header("Cache-Control","no-cache"); }
    void testConnection() throws Exception {
        String xml="<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:resourcetype/></d:prop></d:propfind>";
        try(Response response=client.newCall(request(base).header("Depth","0").method("PROPFIND",RequestBody.create(xml,MediaType.get("application/xml; charset=utf-8"))).build()).execute()) {
            if(response.code()!=207)throw failure(response.code());
        }
    }
    JSONObject read() throws Exception {
        try(Response response=client.newCall(request(fileUrl()).get().build()).execute()) {
            if(response.code()==404)return new JSONObject().put("exists",false);
            if(response.code()!=200)throw failure(response.code());
            if(response.body()==null || response.body().contentLength()>MAX_BYTES)throw new IOException("网盘账本为空或过大，未替换本机数据。");
            String body=readLimited(response.body().byteStream());
            JSONObject envelope;
            try { envelope=new JSONObject(body); } catch(Exception ignored) { throw new IOException("网盘文件不是有效账本，未替换本机数据。"); }
            return new JSONObject().put("exists",true).put("etag",response.header("ETag","")).put("envelope",envelope);
        }
    }
    private void ensureFolders() throws Exception {
        HttpUrl.Builder value=base.newBuilder();
        for(int i=0;i<parts.length-1;i++) {
            value.addPathSegment(parts[i]);
            HttpUrl folder=value.build().newBuilder().addPathSegment("").build();
            try(Response response=client.newCall(request(folder).method("MKCOL",RequestBody.create(new byte[0],null)).build()).execute()) {
                if(response.code()!=201 && response.code()!=405)throw failure(response.code());
            }
        }
    }
    JSONObject write(JSONObject payload) throws Exception {
        String content=payload.getString("content");
        if(content.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES-1024)throw new IOException("账本超过8MB，暂不支持同步。");
        JSONObject book=new JSONObject(content);
        if(book.optInt("version")!=2 || !book.has("months") || !book.has("defaults"))throw new IOException("本机账本格式无效，未上传。");
        boolean exists=payload.getBoolean("exists");String etag=payload.optString("etag","");
        if(exists && (etag.isEmpty() || etag.startsWith("W/")))throw new IOException("缺少有效的网盘版本标识，未覆盖账本。");
        if(!exists)ensureFolders();
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);format.setTimeZone(TimeZone.getTimeZone("UTC"));
        JSONObject envelope=new JSONObject().put("format","dagongren.webdav.v2").put("updatedAt",format.format(new Date())).put("book",book);
        Request.Builder target=request(fileUrl()).put(RequestBody.create(envelope.toString(),JSON));
        target.header(exists?"If-Match":"If-None-Match",exists?etag:"*");
        try(Response response=client.newCall(target.build()).execute()) {
            if(response.code()!=200&&response.code()!=201&&response.code()!=204)throw failure(response.code());
            return new JSONObject().put("saved",true);
        }
    }
    static String readLimited(InputStream input) throws Exception {
        try(InputStream stream=input;ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192];int length,total=0;
            while((length=stream.read(buffer))!=-1){total+=length;if(total>MAX_BYTES)throw new IOException("网盘文件超过8MB，未下载到账本。");out.write(buffer,0,length);}
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
    static final class DavException extends IOException {
        final int status;DavException(int status,String message){super(message);this.status=status;}
    }
    static IOException failure(int code) {
        String message = switch(code) {
            case 401,403 -> "账号、应用密码或访问权限不正确，请检查连接配置。";
            case 409,412 -> "网盘账本已被另一设备更新，本次未覆盖，请重新同步。";
            case 429 -> "坚果云请求过于频繁，请稍后再同步。";
            case 301,302,307,308 -> "服务地址发生跳转，请核对坚果云提供的 HTTPS 地址。";
            case 507 -> "网盘存储空间不足，请清理空间后重试。";
            default -> "网盘连接未完成（状态码 "+code+"），本机记录保留。";
        };
        return new DavException(code,message);
    }
}
