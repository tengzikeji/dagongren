package com.tengzikeji.dagongren;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOME="https://appassets.androidplatform.net/assets/www/index.html";
    private static final int SAVE_FILE=7101;
    private WebView webView;
    private FrameLayout launchCover;
    private static final int LAUNCH_COLOR=Color.rgb(16,30,61);
    private boolean darkAppearance;
    private CredentialVault vault;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ExecutorService calendarWorker=Executors.newSingleThreadExecutor();
    private byte[] pendingFile;
    private Boolean reportedKeyboard;
    private volatile boolean launchIntro=true;
    private boolean systemSplashDelivered=Build.VERSION.SDK_INT<31,launchSurfacePrepared=false,launchNotified=false;
    private boolean firstLaunchFramePresented;

    @Override @SuppressLint({"SetJavaScriptEnabled","JavascriptInterface"})
    public void onCreate(Bundle state) {
        super.onCreate(state); vault=new CredentialVault(this);launchIntro=state==null;systemSplashDelivered=Build.VERSION.SDK_INT<31||state!=null;
        if(Build.VERSION.SDK_INT>=31)getSplashScreen().setOnExitAnimationListener(splash->{
            systemSplashDelivered=true;splash.remove();
            if(launchSurfacePrepared)completeLaunchSurface();

        });

        refreshAppearance();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(launchIntro?LAUNCH_COLOR:appearanceColor());
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard=insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,keyboard.bottom));
                return new WindowInsets.Builder(insets).setInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime(),android.graphics.Insets.NONE).build();
            }else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets.replaceSystemWindowInsets(0,0,0,0);
        });
        // Read unmodified decor insets after layout; child insets may already be cleared.
        android.graphics.Rect visibleFrame=new android.graphics.Rect();
        root.getViewTreeObserver().addOnGlobalLayoutListener(()->{
            if(Build.VERSION.SDK_INT>=30){
                WindowInsets current=getWindow().getDecorView().getRootWindowInsets();
                if(current!=null)reportKeyboard(current.isVisible(WindowInsets.Type.ime()));
            }else{
                root.getWindowVisibleDisplayFrame(visibleFrame);
                reportKeyboard(root.getRootView().getHeight()-visibleFrame.bottom>getResources().getDisplayMetrics().density*150);
            }
        });
        if(launchIntro){
            launchCover=new FrameLayout(this);launchCover.setTag("dagongren-launch-page");launchCover.setBackgroundColor(LAUNCH_COLOR);launchCover.setAlpha(.35f);
            android.widget.ImageView scene=new android.widget.ImageView(this);scene.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
            try(java.io.InputStream image=getAssets().open("www/launch-scene.webp")){scene.setImageBitmap(android.graphics.BitmapFactory.decodeStream(image));}
            catch(java.io.IOException missing){throw new IllegalStateException("Launch scene missing",missing);}
            launchCover.addView(scene,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
            root.addView(launchCover,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        }
        setContentView(root);root.requestApplyInsets();applyAppearance();
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        if(launchCover!=null){
            launchCover.animate().alpha(1f).setDuration(380).withLayer().start();
            root.getViewTreeObserver().addOnDrawListener(new android.view.ViewTreeObserver.OnDrawListener(){
                private boolean submitted;
                @Override public void onDraw(){if(submitted)return;submitted=true;firstLaunchFramePresented=launchCover!=null&&launchCover.getAlpha()>0f&&webView==null;
                    root.post(()->{root.getViewTreeObserver().removeOnDrawListener(this);if(!isDestroyed())initializeWebView(root);});}
            });
        }else root.post(()->{if(!isDestroyed())initializeWebView(root);});
    }

    private void initializeWebView(FrameLayout root){
        webView=new WebView(this);webView.setId(R.id.web_view);
        webView.setBackgroundColor(launchIntro?LAUNCH_COLOR:appearanceColor());
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(false);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if("https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith("/assets/www/")){
                    WebResourceResponse asset=loader.shouldInterceptRequest(uri);
                    if(asset!=null)return asset;
                }
                return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if("https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith("/assets/www/"))return false;
                if(request.isForMainFrame()&&request.hasGesture())openExternal(uri);
                return true;
            }
            @Override public void onPageFinished(WebView view,String url){
                view.evaluateJavascript("document.addEventListener('click',function(e){var a=e.target.closest('a[target=\"_blank\"]');if(a&&a.href.startsWith('https:')){e.preventDefault();AndroidFiles.openLink(a.href);}});",null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativeFiles(),"AndroidFiles");
        root.addView(webView,0,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        webView.loadUrl(HOME);
    }

    private boolean systemIsDark(){return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;}
    private int appearanceColor(){return darkAppearance?Color.rgb(16,24,39):Color.rgb(243,245,249);}
    private void refreshAppearance(){
        String mode=getSharedPreferences("appearance",MODE_PRIVATE).getString("mode","system");
        darkAppearance="dark".equals(mode)||("system".equals(mode)&&systemIsDark());
    }
    @SuppressWarnings("deprecation") private void applyAppearance(){
        int color=launchIntro?LAUNCH_COLOR:appearanceColor();
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(color));
        getWindow().getDecorView().setBackgroundColor(color);getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
        getWindow().getDecorView().setSystemUiVisibility(launchIntro||darkAppearance?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if(webView!=null){webView.setBackgroundColor(color);if(webView.getParent() instanceof View)((View)webView.getParent()).setBackgroundColor(color);}
    }
    @Override public void onConfigurationChanged(Configuration config){
        super.onConfigurationChanged(config);refreshAppearance();applyAppearance();
        if(webView!=null)webView.evaluateJavascript("globalThis.dagongrenSystemTheme && globalThis.dagongrenSystemTheme("+systemIsDark()+");",null);
    }

    private void prepareLaunchSurface(){
        if(webView==null||isDestroyed()||launchSurfacePrepared)return;
        webView.postVisualStateCallback(1,new WebView.VisualStateCallback(){
            @Override public void onComplete(long requestId){launchSurfacePrepared=true;completeLaunchSurface();}
        });
    }

    private void completeLaunchSurface(){
        if(!systemSplashDelivered)return;
        if(launchCover!=null){FrameLayout cover=launchCover;launchCover=null;cover.animate().alpha(0f).setDuration(220).withEndAction(()->{if(cover.getParent() instanceof FrameLayout)((FrameLayout)cover.getParent()).removeView(cover);}).start();}
        if(!launchNotified&&webView!=null&&!isDestroyed()){
            launchNotified=true;
            webView.evaluateJavascript("globalThis.dagongrenLaunchReady && globalThis.dagongrenLaunchReady();",null);
        }
    }

    public boolean isLaunchSurfaceReady(){return launchNotified;}
    public boolean isFirstLaunchFramePresented(){return firstLaunchFramePresented;}

    private void reportKeyboard(boolean visible){
        if(webView==null||Boolean.valueOf(visible).equals(reportedKeyboard))return;
        reportedKeyboard=visible;
        webView.evaluateJavascript("globalThis.dagongrenKeyboard && globalThis.dagongrenKeyboard("+visible+");",null);
    }

    private void openExternal(Uri uri){
        if(!"https".equals(uri.getScheme())||uri.getHost()==null)return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(android.content.ActivityNotFoundException ignored){notice("手机上没有可用浏览器。");}
    }
    private void handleBack(){
        if(webView==null){moveTaskToBack(true);return;}
        webView.evaluateJavascript("Boolean(globalThis.dagongrenBack && globalThis.dagongrenBack())",value->{if(!"true".equals(value))moveTaskToBack(true);});
    }
    @Override @SuppressWarnings("deprecation") public void onBackPressed(){handleBack();}
    private void notice(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}
    private JSONObject currentConfig() throws Exception {
        JSONObject config=vault.load();if(config==null)throw new IllegalStateException("请先配置坚果云账号和应用密码。");return config;
    }
    private void respond(String id,JSONObject result){
        runOnUiThread(()->{if(!isDestroyed())webView.evaluateJavascript("globalThis.dagongrenNativeResult && globalThis.dagongrenNativeResult("+JSONObject.quote(id)+","+result+");",null);});
    }
    public final class NativeFiles {
        @JavascriptInterface public boolean shouldPlayIntro(){return launchIntro;}
        @JavascriptInterface public boolean nativeLaunchPage(){return launchIntro;}
        @JavascriptInterface public void introReady(){runOnUiThread(()->{if(launchNotified&&webView!=null&&!isDestroyed())webView.evaluateJavascript("globalThis.dagongrenLaunchReady && globalThis.dagongrenLaunchReady();",null);else prepareLaunchSurface();});}
        @JavascriptInterface public boolean systemDark(){return systemIsDark();}
        @JavascriptInterface public void themeStyle(String mode){
            if(!"system".equals(mode)&&!"light".equals(mode)&&!"dark".equals(mode))return;
            runOnUiThread(()->{
                android.content.SharedPreferences preferences=getSharedPreferences("appearance",MODE_PRIVATE);
                if(!mode.equals(preferences.getString("mode","system")))preferences.edit().putString("mode",mode).apply();
                boolean previous=darkAppearance;refreshAppearance();if(previous!=darkAppearance)applyAppearance();
            });
        }
        @JavascriptInterface public void introStyle(boolean active){runOnUiThread(()->{if(!active)launchIntro=false;applyAppearance();});}
        @JavascriptInterface public String status(){
            try{return CredentialVault.publicConfig(vault.load()).toString();}
            catch(Exception ignored){return "{\"configured\":false,\"error\":\"原连接配置无法读取，请重新配置。\"}";}
        }
        @JavascriptInterface public String fingerprint(String input){
            try{
                byte[] bytes=MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
                StringBuilder result=new StringBuilder();for(byte value:bytes)result.append(String.format(java.util.Locale.US,"%02x",value&255));
                return result.toString();
            }catch(Exception ignored){throw new IllegalStateException("无法校验账本，已暂停同步。");}
        }
        @JavascriptInterface public void openLink(String link){runOnUiThread(()->openExternal(Uri.parse(link)));}
        @JavascriptInterface public void request(String id,String action,String payload){
            if(id==null||id.length()>100)return;
            ("calendar-read".equals(action)?calendarWorker:worker).execute(()->{
                JSONObject result=new JSONObject();
                try{
                    JSONObject input=new JSONObject(payload),output;
                    switch(action){
                        case "calendar-read": output=new HolidayClient().readYear(input.getInt("year"));break;
                        case "configure":
                            JSONObject old=vault.load();
                            String url=input.getString("url").trim();if(!url.endsWith("/"))url+="/";
                            String username=input.getString("username").trim(),password=input.getString("password");
                            if(password.isEmpty()){
                                if(old==null||!old.getString("url").equals(url)||!old.getString("username").equals(username))
                                    throw new IllegalArgumentException("修改服务地址或账号时，请重新填写应用密码。");
                                password=old.getString("password");
                            }
                            JSONObject candidate=new JSONObject().put("url",url).put("username",username).put("password",password).put("path",input.getString("path").trim());
                            WebDavClient connection=new WebDavClient(candidate);connection.testConnection();connection.prepareBookLocation();vault.save(candidate);output=CredentialVault.publicConfig(candidate);break;
                        case "read": output=new WebDavClient(currentConfig()).read();break;
                        case "write": output=new WebDavClient(currentConfig()).write(input);break;
                        case "disconnect": vault.clear();output=new JSONObject().put("removed",true);break;
                        default: throw new IllegalArgumentException("不支持的操作。");
                    }
                    result.put("ok",true).put("data",output);
                }catch(Exception error){
                    String message=error.getMessage();
                    if(message==null||!message.chars().anyMatch(c->c>127))message="网络连接未完成，请检查网络或服务地址后重试。本机记录保留。";
                    try{result.put("ok",false).put("error",message);if(error instanceof WebDavClient.DavException)result.put("code",((WebDavClient.DavException)error).status);}catch(Exception ignored){}
                }
                respond(id,result);
            });
        }
        @JavascriptInterface public void saveFile(String name,String mime,String content){
            if(content==null||content.getBytes(StandardCharsets.UTF_8).length>10*1024*1024){notice("导出文件过大，请减少记录范围。");return;}
            if(!"text/csv".equals(mime)&&!"application/json".equals(mime))return;
            if(name==null)return;
            String safeName=name.replace((char)47,'_').replace((char)92,'_').replace((char)10,'_').replace((char)13,'_');
            runOnUiThread(()->{
                if(pendingFile!=null){notice("请先完成上一次文件保存。");return;}
                pendingFile=content.getBytes(StandardCharsets.UTF_8);
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,safeName);
                try{startActivityForResult(intent,SAVE_FILE);}catch(android.content.ActivityNotFoundException ignored){pendingFile=null;notice("手机没有可用的文件保存界面。");}
            });
        }
    }
    @Override @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);if(requestCode!=SAVE_FILE)return;
        byte[] bytes=pendingFile;pendingFile=null;
        if(resultCode!=RESULT_OK||data==null||data.getData()==null||bytes==null)return;
        Uri uri=data.getData();
        worker.execute(()->{
            try(OutputStream stream=getContentResolver().openOutputStream(uri,"wt")){
                if(stream==null)throw new java.io.IOException();stream.write(bytes);notice("账本已保存到所选位置。");
            }catch(Exception ignored){notice("文件保存失败，账本仍保存在本机。");}
        });
    }
    @Override protected void onResume(){super.onResume();if(webView!=null)webView.onResume();}
    @Override protected void onPause(){if(webView!=null)webView.onPause();super.onPause();}
    @Override protected void onDestroy(){
        worker.shutdownNow();calendarWorker.shutdownNow();if(webView!=null){webView.removeJavascriptInterface("AndroidFiles");webView.destroy();}super.onDestroy();
    }
}
