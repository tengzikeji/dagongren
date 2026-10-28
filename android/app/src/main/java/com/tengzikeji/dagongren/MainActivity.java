package com.tengzikeji.dagongren;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Choreographer;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
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
    private View systemSplashView;
    private static final int LAUNCH_COLOR=Color.rgb(16,30,61);
    private boolean darkAppearance;
    private final android.graphics.drawable.ColorDrawable windowCanvas=new android.graphics.drawable.ColorDrawable(LAUNCH_COLOR);
    private CredentialVault vault;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ExecutorService calendarWorker=Executors.newSingleThreadExecutor();
    private byte[] pendingFile;
    private Boolean reportedKeyboard;
    private volatile boolean launchIntro=true;
    private boolean launchSurfacePrepared=false,launchNotified=false;
    private boolean firstLaunchFramePresented;
    private int systemBarIconUpdates;
    private Integer paintedWindowColor;
    private Choreographer.FrameCallback launchBarFrame;
    private boolean launchBarsFading;

    @Override @SuppressLint({"SetJavaScriptEnabled","JavascriptInterface"})
    public void onCreate(Bundle state) {
        super.onCreate(state); vault=new CredentialVault(this);launchIntro=state==null;
        refreshAppearance();
        // Match the starting theme before attaching content or changing insets.
        getWindow().setBackgroundDrawable(windowCanvas);
        if(Build.VERSION.SDK_INT>=29){getWindow().setStatusBarContrastEnforced(false);getWindow().setNavigationBarContrastEnforced(false);}
        applyAppearance();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(launchIntro?LAUNCH_COLOR:appearanceColor());
        if(Build.VERSION.SDK_INT>=31)getSplashScreen().setOnExitAnimationListener(window->{
            // Keep the real system splash over the attached, hardware-rendered WebView.
            // Never hold pre-draw: WebView must be allowed to submit its first frame.
            if(launchNotified)window.remove();
            else{systemSplashView=window;if(launchSurfacePrepared)completeLaunchSurface();}
        });
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
        setContentView(root);root.requestApplyInsets();applyAppearance();
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        // Start loading immediately; there is no bitmap cover, fade-in or 400ms delay.
        initializeWebView(root);
    }

    private void initializeWebView(FrameLayout root){
        webView=new WebView(this);webView.setId(R.id.web_view);
        webView.setBackgroundColor(launchIntro?LAUNCH_COLOR:appearanceColor());
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setOffscreenPreRaster(launchIntro);
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
    private void applyAppearance(){
        if(launchIntro&&launchBarsFading)return;
        paintAppearance(launchIntro?LAUNCH_COLOR:appearanceColor(),launchIntro||darkAppearance);
    }
    @SuppressWarnings("deprecation") private void paintAppearance(int color,boolean darkBars){
        if(paintedWindowColor==null||paintedWindowColor!=color){
            paintedWindowColor=color;windowCanvas.setColor(color);
            getWindow().getDecorView().setBackgroundColor(color);getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
        }
        // Change icon appearance without resetting layout/visibility flags on each frame.
        if((!launchIntro||launchBarsFading)&&Build.VERSION.SDK_INT>=30){
            WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null){int mask=WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,desired=darkBars?0:mask;if((controller.getSystemBarsAppearance()&mask)!=desired){controller.setSystemBarsAppearance(desired,mask);systemBarIconUpdates++;}}
        }else if(!launchIntro||launchBarsFading){
            View decor=getWindow().getDecorView();int mask=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            int flags=decor.getSystemUiVisibility(),next=(flags&~mask)|(darkBars?0:mask);if(flags!=next)decor.setSystemUiVisibility(next);
        }
        // The live HTML covers the WebView during the intro; changing its native
        // background every animation frame unnecessarily invalidates Chromium.
        if(webView!=null){if(!launchIntro)webView.setBackgroundColor(color);if(webView.getParent() instanceof View)((View)webView.getParent()).setBackgroundColor(color);}
    }
    private void fadeLaunchAppearance(int duration,int elapsed){
        if(!launchIntro||isDestroyed())return;
        stopLaunchBarTransition();launchBarsFading=true;
        final int from=paintedWindowColor==null?LAUNCH_COLOR:paintedWindowColor;
        if(duration<=0){paintAppearance(appearanceColor(),darkAppearance);launchBarsFading=false;return;}
        final long began=System.nanoTime()-Math.max(0,Math.min(duration,elapsed))*1000000L,length=Math.min(duration,2000)*1000000L;
        final android.view.animation.Interpolator easing=new android.view.animation.PathInterpolator(.42f,0f,.58f,1f);
        // The web fade and native chrome share one ease-in-out clock. Only the
        // chrome is repainted on vsync; WebView content and layout stay intact.
        launchBarFrame=at->{
            if(!launchIntro||isDestroyed()){stopLaunchBarTransition();return;}
            float progress=Math.max(0f,Math.min(1f,(at-began)/(float)length)),blend=easing.getInterpolation(progress);
            int target=appearanceColor(),color=Color.rgb(Math.round(Color.red(from)+(Color.red(target)-Color.red(from))*blend),Math.round(Color.green(from)+(Color.green(target)-Color.green(from))*blend),Math.round(Color.blue(from)+(Color.blue(target)-Color.blue(from))*blend));
            paintAppearance(color,darkBarColor(color));
            if(progress<1f)Choreographer.getInstance().postFrameCallback(launchBarFrame);
            else{launchBarFrame=null;launchBarsFading=false;}
        };
        Choreographer.getInstance().postFrameCallback(launchBarFrame);
    }
    private void stopLaunchBarTransition(){if(launchBarFrame!=null)Choreographer.getInstance().removeFrameCallback(launchBarFrame);launchBarFrame=null;launchBarsFading=false;}
    private static double luminance(int value){double channel=value/255.0;return channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4);}
    private static boolean darkBarColor(int color){return .2126*luminance(Color.red(color))+.7152*luminance(Color.green(color))+.0722*luminance(Color.blue(color))<=.179;}
    @Override public void onConfigurationChanged(Configuration config){
        super.onConfigurationChanged(config);refreshAppearance();applyAppearance();
        if(webView!=null)webView.evaluateJavascript("globalThis.dagongrenSystemTheme && globalThis.dagongrenSystemTheme("+systemIsDark()+");",null);
    }

    private void prepareLaunchSurface(){
        if(webView==null||isDestroyed()||launchSurfacePrepared)return;
        webView.postVisualStateCallback(1,new WebView.VisualStateCallback(){
            @Override public void onComplete(long requestId){
                // The next draw contains the DOM submitted before this callback.
                // Wait for that draw to finish before removing the system surface.
                webView.getViewTreeObserver().addOnDrawListener(new android.view.ViewTreeObserver.OnDrawListener(){
                    private boolean submitted;
                    @Override public void onDraw(){if(submitted)return;submitted=true;
                        webView.post(()->{if(isDestroyed())return;webView.getViewTreeObserver().removeOnDrawListener(this);firstLaunchFramePresented=true;launchSurfacePrepared=true;completeLaunchSurface();});
                    }
                });
                webView.invalidate();
            }
        });
    }

    private void completeLaunchSurface(){
        if(launchNotified||!launchSurfacePrepared||isDestroyed())return;
        if(Build.VERSION.SDK_INT>=31&&systemSplashView!=null){((android.window.SplashScreenView)systemSplashView).remove();systemSplashView=null;}
        notifyLaunchSurface();
    }
    private void notifyLaunchSurface(){
        if(!launchNotified&&webView!=null&&!isDestroyed()){
            launchNotified=true;
            webView.evaluateJavascript("globalThis.dagongrenLaunchReady && globalThis.dagongrenLaunchReady();",null);
        }
    }

    public boolean isLaunchSurfaceReady(){return launchNotified;}
    public boolean isFirstLaunchFramePresented(){return firstLaunchFramePresented;}
    public int getSystemBarIconUpdateCount(){return systemBarIconUpdates;}
    public boolean hasBitmapLaunchCover(){return getWindow().getDecorView().findViewWithTag("dagongren-launch-page")!=null;}
    public boolean isNativeMotionEnabled(){return getSharedPreferences("appearance",MODE_PRIVATE).getBoolean("motionEnabled",true);}

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
        @JavascriptInterface public boolean nativeLaunchPage(){return false;}
        @JavascriptInterface public void motionStyle(boolean enabled){
            android.content.SharedPreferences preferences=getSharedPreferences("appearance",MODE_PRIVATE);
            if(!preferences.contains("motionEnabled")||preferences.getBoolean("motionEnabled",true)!=enabled)preferences.edit().putBoolean("motionEnabled",enabled).apply();
        }
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
        @JavascriptInterface public void introTransition(int duration){runOnUiThread(()->fadeLaunchAppearance(duration,0));}
        @JavascriptInterface public void introTransitionAt(int duration,int elapsed){runOnUiThread(()->fadeLaunchAppearance(duration,elapsed));}
        @JavascriptInterface public void introStyle(boolean active){runOnUiThread(()->{if(!active){stopLaunchBarTransition();launchIntro=false;if(webView!=null)webView.getSettings().setOffscreenPreRaster(false);}applyAppearance();});}
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
        stopLaunchBarTransition();
        if(Build.VERSION.SDK_INT>=31&&systemSplashView!=null){((android.window.SplashScreenView)systemSplashView).remove();systemSplashView=null;}
        worker.shutdownNow();calendarWorker.shutdownNow();if(webView!=null){webView.removeJavascriptInterface("AndroidFiles");webView.destroy();}super.onDestroy();
    }
}
