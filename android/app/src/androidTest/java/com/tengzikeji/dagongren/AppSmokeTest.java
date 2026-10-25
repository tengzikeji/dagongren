package com.tengzikeji.dagongren;

import static org.junit.Assert.*;
import android.content.Context;
import android.view.WindowInsets;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private boolean withActivity(java.util.function.Consumer<MainActivity> action) {
        java.util.concurrent.atomic.AtomicBoolean found=new java.util.concurrent.atomic.AtomicBoolean(false);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            for(android.app.Activity activity:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED)){
                if(activity instanceof MainActivity){found.set(true);action.accept((MainActivity)activity);break;}
            }
        });
        return found.get();
    }
    private String evaluate(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        if(!withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);if(web.getProgress()<100){result.set("null");latch.countDown();return;}web.evaluateJavascript(script,value->{result.set(value);latch.countDown();});}))return "null";
        assertTrue("WebView evaluation timed out: "+script,latch.await(25,TimeUnit.SECONDS));return result.get();
    }
    private void waitTrue(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        long deadline=System.currentTimeMillis()+20000;String last="";
        while(System.currentTimeMillis()<deadline){
            last=evaluate(scenario,script);if("true".equals(last))return;
            Thread.sleep(150);
        }
        screenshot("condition-failed");
        String details=evaluate(scenario,"JSON.stringify({view:document.querySelector('.bottom-nav [aria-current=page]')?.dataset.view,classes:document.getElementById('app').className,viewport:[innerWidth,innerHeight,visualViewport.height],keyboard:document.body.classList.contains('keyboard-open'),focused:document.activeElement.id,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.motion,introAllowed:AndroidFiles.shouldPlayIntro(),rects:['.modal','.modal-body','.modal-footer','#company-name'].map(s=>{const e=document.querySelector(s);return e?{s,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}:null})})");
        fail("Condition did not become true: "+script+"; last result: "+last+"; "+details);
    }
    private void waitReady(ActivityScenario<MainActivity> scenario) throws Exception {
        waitTrue(scenario,"Boolean(document.querySelector('.bottom-nav'))");
    }
    private void resetBook(ActivityScenario<MainActivity> scenario) throws Exception {
        waitReady(scenario);evaluate(scenario,"localStorage.clear()");scenario.recreate();waitReady(scenario);
    }
    private boolean keyboardVisible(ActivityScenario<MainActivity> scenario) {
        AtomicReference<Boolean> result=new AtomicReference<>(false);
        withActivity(activity->{WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();result.set(insets!=null&&insets.isVisible(WindowInsets.Type.ime()));});
        return result.get();
    }
    private void screenshot(String name) throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("mkdir -p /sdcard/Download/dagongren-test");
        device.executeShellCommand("screencap -p /sdcard/Download/dagongren-test/"+name+".png");
    }
    private void paintedScreenshot(ActivityScenario<MainActivity> scenario,String name) throws Exception {
        evaluate(scenario,"window.__upgradePaintReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__upgradePaintReady=true;}))");
        waitTrue(scenario,"window.__upgradePaintReady===true");
        CountDownLatch frame=new CountDownLatch(1);
        withActivity(activity->((WebView)activity.findViewById(R.id.web_view)).postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){frame.countDown();}}));
        assertTrue("WebView frame was not committed",frame.await(10,TimeUnit.SECONDS));
        Thread.sleep(100);
        screenshot(name);
    }
    @Test public void appLoadsSavesWagesAndOffersEditableConnection() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            withActivity(activity->{assertEquals("打工人",activity.getString(R.string.app_name));assertEquals(0,activity.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE);});
            resetBook(scenario);
            assertEquals("4",evaluate(scenario,"document.querySelectorAll('.bottom-nav button').length"));
            assertEquals("0",evaluate(scenario,"JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.salaryCents"));
            evaluate(scenario,"document.querySelector('[data-action=salary-settings]').click()");
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.modal-footer button[form=salary-form]'))"));
            evaluate(scenario,"document.querySelector('#salary-form [name=salary]').value='6500';document.querySelector('.modal-footer button[type=submit]').click()");
            assertEquals("650000",evaluate(scenario,"JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.salaryCents"));
            scenario.recreate();waitReady(scenario);
            assertEquals("650000",evaluate(scenario,"JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.salaryCents"));
            evaluate(scenario,"document.querySelector('[data-view=sync]').click()");
            evaluate(scenario,"document.querySelector('[data-action=connection-settings]').click()");
            assertEquals("true",evaluate(scenario,"Boolean(document.getElementById('cloud-account')&&!document.getElementById('cloud-account').disabled)"));
            assertEquals("\"password\"",evaluate(scenario,"document.getElementById('cloud-password').type"));
            assertEquals("true",evaluate(scenario,"globalThis.dagongrenBack()"));
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('#webdav-form'))"));
        }
    }
    @Test public void redesignedCalendarProfileAndRealKeyboardStayUsable() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"打开我的\"]'))"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav').getBoundingClientRect().height<=66"));
            paintedScreenshot(scenario,"home");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click()");
            evaluate(scenario,"document.querySelector('[data-action=calendar-today]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('[aria-current=date]'))");
            assertEquals("true",evaluate(scenario,"document.querySelector('[aria-current=date]').dataset.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())"));
            paintedScreenshot(scenario,"calendar-today");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click()");
            evaluate(scenario,"document.getElementById('company-name').value='示例科技有限公司·杭州电商运营服务中心';document.querySelector('.modal-footer button[type=submit]').click()");
            waitTrue(scenario,"!document.querySelector('#company-form')");
            assertEquals("true",evaluate(scenario,"document.querySelector('.profile-join').getBoundingClientRect().top>=document.querySelector('.profile-company').getBoundingClientRect().bottom"));
            assertEquals("true",evaluate(scenario,"document.body.scrollWidth<=innerWidth"));
            assertEquals("true",evaluate(scenario,"getComputedStyle(document.querySelector('.profile-company')).whiteSpace==='nowrap'"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.profile-name-viewport').clientWidth>document.querySelector('.profile-card').clientWidth*.8"));
            paintedScreenshot(scenario,"profile-wrap");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click()");
            JSONObject position=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const r=document.getElementById('company-name').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())")).nextValue().toString());
            int[] location=new int[2];float[] scale=new float[1];
            withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(location);scale[0]=activity.getResources().getDisplayMetrics().density;});
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            assertTrue(device.click(location[0]+Math.round((float)position.getDouble("x")*scale[0]),location[1]+Math.round((float)position.getDouble("y")*scale[0])));
            long deadline=System.currentTimeMillis()+15000;
            while(!keyboardVisible(scenario)&&System.currentTimeMillis()<deadline)Thread.sleep(150);
            assertTrue("Real Android keyboard did not open",keyboardVisible(scenario));
            paintedScreenshot(scenario,"keyboard-open-before-check");
            waitTrue(scenario,"(()=>{const input=document.activeElement,footer=document.querySelector('.modal-footer'),body=document.querySelector('.modal-body'),modal=document.querySelector('.modal');if(input.id!=='company-name')return false;const r=input.getBoundingClientRect(),f=footer.getBoundingClientRect(),b=body.getBoundingClientRect(),m=modal.getBoundingClientRect(),h=Math.min(innerHeight,visualViewport.height);return r.top>=b.top-1&&r.bottom<=b.bottom+1&&f.bottom<=h+1&&m.top>=8&&m.bottom<=h-8})()");
            waitTrue(scenario,"document.body.classList.contains('keyboard-open')");
            paintedScreenshot(scenario,"keyboard-centered");
            device.pressBack();
            deadline=System.currentTimeMillis()+10000;
            while(keyboardVisible(scenario)&&System.currentTimeMillis()<deadline)Thread.sleep(150);
            assertFalse("Keyboard stayed visible",keyboardVisible(scenario));
            evaluate(scenario,"document.querySelector('.modal-footer button[type=submit]').click()");
            waitTrue(scenario,"!document.querySelector('#company-form')");
            paintedScreenshot(scenario,"profile-final");
        }
    }
    @Test public void credentialsStayEncryptedAndOutOfPublicConfig() throws Exception {
        Context context=ApplicationProvider.getApplicationContext();CredentialVault vault=new CredentialVault(context);
        JSONObject config=new JSONObject().put("url","https://dav.jianguoyun.com/dav/").put("username","test@example.invalid").put("password","instrumentation-test-only").put("path","dagongren/paybook.json");
        try {
            vault.save(config);
            assertEquals("instrumentation-test-only",vault.load().getString("password"));
            assertFalse(context.getSharedPreferences("webdav-vault",Context.MODE_PRIVATE).getAll().toString().contains("instrumentation-test-only"));
            assertFalse(CredentialVault.publicConfig(vault.load()).has("password"));
        } finally { vault.clear(); }
    }

    @Test public void cleanupRebuildAndCardPickerPreserveDraft() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=salary-settings]').click();document.getElementById('salary').value='6000';document.querySelector('.modal-footer button[type=submit]').click()");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click();document.getElementById('company-name').value='升级测试公司';const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-2);document.getElementById('join-date').value=d.toISOString().slice(0,10);document.querySelector('.modal-footer button[type=submit]').click()");
            assertEquals("3",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-action=open-cleanup]').click();document.querySelector('[data-action=cleanup-scope][data-scope=year]').click();document.querySelector('[data-action=cleanup-scope][data-scope=all]').click()");
            assertEquals("3",evaluate(scenario,"document.querySelectorAll('.cleanup-scope-card').length"));
            paintedScreenshot(scenario,"cleanup-range-cards");
            evaluate(scenario,"document.querySelector('[data-action=review-cleanup]').click();document.querySelector('[data-action=confirm-cleanup]').click()");
            assertEquals("0",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click();document.querySelector('.modal-footer button[type=submit]').click()");
            assertEquals("3",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-action=record-entry]').click();document.querySelector('[data-kind=payment]').click();const a=document.getElementById('cash-amount');a.value='123.45';a.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('cash-note').value='保留填写内容';document.querySelector('.select-trigger').click()");
            waitTrue(scenario,"Boolean(document.querySelector('.choice-sheet .choice-card'))");
            paintedScreenshot(scenario,"payment-period-cards");
            evaluate(scenario,"document.querySelector('.choice-card:not(.selected)').click()");
            assertEquals("\"123.45\"",evaluate(scenario,"document.getElementById('cash-amount').value"));
            assertEquals("\"保留填写内容\"",evaluate(scenario,"document.getElementById('cash-note').value"));
            evaluate(scenario,"document.querySelector('.select-trigger').click()");
            assertEquals("true",evaluate(scenario,"globalThis.dagongrenBack()"));
            assertEquals("true",evaluate(scenario,"Boolean(document.getElementById('payment-form'))"));
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('.choice-sheet'))"));
            evaluate(scenario,"globalThis.dagongrenBack();globalThis.dagongrenBack();document.querySelector('[data-view=calendar]').click()");
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"打开我的\"]'))"));
            evaluate(scenario,"document.querySelector('[data-view=records]').click()");
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"打开我的\"]'))"));
            evaluate(scenario,"document.querySelector('[data-view=home]').click();window.__upgradeHero=document.querySelector('.balance-hero');document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('.balance-hero')===window.__upgradeHero"));
            paintedScreenshot(scenario,"stable-date-query");
        }
    }
    @Test public void coldStartupUsesOneSurfaceAndFlowsIntoHome() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("settings put global window_animation_scale 1");
        device.executeShellCommand("settings put global transition_animation_scale 1");
        device.executeShellCommand("settings put global animator_duration_scale 1");
        device.executeShellCommand("mkdir -p /sdcard/Download/dagongren-test");
        long recordingStarted=System.currentTimeMillis();
        Thread recording=new Thread(()->{try{device.executeShellCommand("screenrecord --size 720x1280 --bit-rate 2000000 --time-limit 30 /sdcard/Download/dagongren-test/startup-transition.mp4");}catch(Exception ignored){}},"startup-recording");recording.setDaemon(true);recording.start();
        ActivityScenario<MainActivity> scenario=null;
        android.content.Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        target.startActivity(new android.content.Intent(target,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK));
        try{
            waitTrue(scenario,"(()=>{if(!document.querySelector('.launch-page[data-phase=playing]'))return false;window.__launchObserved={at:Date.now(),surfaces:document.querySelectorAll('.launch-page').length,oldBrand:Boolean(document.querySelector('.brand-intro')),inert:document.getElementById('app').inert,animated:getComputedStyle(document.querySelector('.launch-ledger')).animationName==='launch-card-in'};return true})()");
            assertEquals("1",evaluate(scenario,"window.__launchObserved.surfaces"));
            assertEquals("false",evaluate(scenario,"window.__launchObserved.oldBrand"));
            assertEquals("true",evaluate(scenario,"window.__launchObserved.inert"));
            assertEquals("true",evaluate(scenario,"window.__launchObserved.animated"));
            double playingSecond=(Double.parseDouble(evaluate(scenario,"window.__launchObserved.at"))-recordingStarted)/1000.0;
            device.executeShellCommand("sh -c 'echo "+playingSecond+" > /sdcard/Download/dagongren-test/startup-playing-second.txt'");
            paintedScreenshot(scenario,"startup-interface");
            waitTrue(scenario,"!document.querySelector('.launch-page')");
            assertEquals("false",evaluate(scenario,"document.getElementById('app').inert"));
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.bottom-nav'))"));
            paintedScreenshot(scenario,"startup-home");
        } finally {
            withActivity(activity->activity.finish());
            recording.join(35000);
            device.executeShellCommand("settings put global window_animation_scale 0");
            device.executeShellCommand("settings put global transition_animation_scale 0");
            device.executeShellCommand("settings put global animator_duration_scale 0");
        }
    }
    private void swipeCalendar(ActivityScenario<MainActivity> scenario,int direction) throws Exception {
        swipeRegion(scenario,".calendar-days",direction);
    }
    private void swipeRegion(ActivityScenario<MainActivity> scenario,String selector,int direction) throws Exception {
        JSONObject rect=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const r=document.querySelector('"+selector+"').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,y:Math.min(r.top+Math.min(100,r.height*.5),visualViewport.height-120)}})())")).nextValue().toString());
        int[] origin=new int[2];float[] density=new float[1];
        withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(origin);density[0]=activity.getResources().getDisplayMetrics().density;});
        double left=rect.getDouble("left"),width=rect.getDouble("width"),y=rect.getDouble("y");
        double from=left+width*(direction==0?.5:direction>0?.8:.2),to=left+width*(direction==0?.5:direction>0?.2:.8);
        int x1=origin[0]+Math.round((float)from*density[0]),x2=origin[0]+Math.round((float)to*density[0]),y1=origin[1]+Math.round((float)y*density[0]),y2=origin[1]+Math.round((float)(direction==0?y-80:y)*density[0]);
        assertTrue("Swipe gesture could not be delivered",UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).swipe(x1,y1,x2,y2,24));
    }
    @Test public void calendarRollsAndEntryFiltersRemainStableAndReadable() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("settings put global window_animation_scale 1");
        device.executeShellCommand("settings put global transition_animation_scale 1");
        device.executeShellCommand("settings put global animator_duration_scale 1");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            waitTrue(scenario,"!matchMedia('(prefers-reduced-motion: reduce)').matches");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=salary-settings]').click();document.getElementById('salary').value='6000';document.querySelector('.modal-footer button[type=submit]').click()");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click();const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-2);document.getElementById('join-date').value=d.toISOString().slice(0,10);document.querySelector('.modal-footer button[type=submit]').click();document.querySelector('[data-view=home]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();Boolean(document.querySelector('.number-roll-strip')) && [...document.querySelectorAll('.number-roll-strip')].every(e=>Number(e.style.getPropertyValue('--roll-steps'))>=30)"));
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            waitTrue(scenario,"!document.querySelector('.number-roll-strip')");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();window.__calendarHeight=document.querySelector('.calendar-days').getBoundingClientRect().height;for(let i=0;i<5;i++)document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();for(let i=0;i<5;i++)document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            assertEquals("42",evaluate(scenario,"document.querySelector('.calendar-days').children.length"));
            assertEquals("true",evaluate(scenario,"Math.abs(document.querySelector('.calendar-days').getBoundingClientRect().height-window.__calendarHeight)<1"));
            assertEquals("0",evaluate(scenario,"document.querySelectorAll('.calendar-day .number-roll-strip').length"));
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.calendar-day[data-date]')].every(e=>Number(e.dataset.date.slice(8))===Number(e.querySelector('.day-number').childNodes[0].nodeValue))"));
            evaluate(scenario,"window.__beforeSwipe=document.querySelector('.month-display').textContent");
            swipeCalendar(scenario,1);
            waitTrue(scenario,"document.querySelector('.month-display').textContent!==window.__beforeSwipe");
            assertEquals("false",evaluate(scenario,"Boolean(document.getElementById('modal-root').firstElementChild)"));
            swipeCalendar(scenario,-1);
            waitTrue(scenario,"document.querySelector('.month-display').textContent===window.__beforeSwipe");
            swipeCalendar(scenario,0);
            assertEquals("true",evaluate(scenario,"document.querySelector('.month-display').textContent===window.__beforeSwipe"));
            paintedScreenshot(scenario,"calendar-stable");
            evaluate(scenario,"document.querySelector('[data-view=records]').click();document.querySelector('[data-action=detail-tab][data-tab=entries]').click()");
            for(String kind:new String[]{"all","leave","overtime","subsidy","deduction","advance","payment"}){
                evaluate(scenario,"document.querySelector('[data-action=entry-filter][data-filter="+kind+"]').click()");
                assertEquals("true",evaluate(scenario,"(()=>{const el=document.querySelector('.entry-filters [aria-pressed=true]'),s=getComputedStyle(el),rgb=v=>v.match(/[\\d.]+/g).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}),lum=v=>{const a=rgb(v);return .2126*a[0]+.7152*a[1]+.0722*a[2]},a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5})()"));
            }
            paintedScreenshot(scenario,"entry-filter-contrast");
        } finally {
            device.executeShellCommand("settings put global window_animation_scale 0");
            device.executeShellCommand("settings put global transition_animation_scale 0");
            device.executeShellCommand("settings put global animator_duration_scale 0");
        }
    }

    @Test public void mainPageSwipesKeepCalendarNamesAndFormsIndependent() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("settings put global window_animation_scale 1");
        device.executeShellCommand("settings put global transition_animation_scale 1");
        device.executeShellCommand("settings put global animator_duration_scale 1");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            waitTrue(scenario,"!matchMedia('(prefers-reduced-motion: reduce)').matches");
            for(String next:new String[]{"calendar","records","settings"}){
                swipeRegion(scenario,".topbar",1);
                waitTrue(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='"+next+"'&&!document.getElementById('app').classList.contains('page-transitioning')");
            }
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click();document.getElementById('company-name').value='页面滑动保留草稿'");
            swipeRegion(scenario,".modal-body",1);
            assertEquals("true",evaluate(scenario,"Boolean(document.getElementById('company-form'))"));
            assertEquals("\"页面滑动保留草稿\"",evaluate(scenario,"document.getElementById('company-name').value"));
            evaluate(scenario,"document.querySelector('[data-action=close-modal]').click()");
            swipeRegion(scenario,".profile-name-viewport",1);
            assertEquals("\"settings\"",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view"));
            for(String previous:new String[]{"records","calendar","home"}){
                swipeRegion(scenario,".topbar",-1);
                waitTrue(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='"+previous+"'&&!document.getElementById('app').classList.contains('page-transitioning')");
            }
            swipeRegion(scenario,".topbar",-1);
            assertEquals("\"home\"",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view"));
        } finally {
            device.executeShellCommand("settings put global window_animation_scale 0");
            device.executeShellCommand("settings put global transition_animation_scale 0");
            device.executeShellCommand("settings put global animator_duration_scale 0");
        }
    }

}
