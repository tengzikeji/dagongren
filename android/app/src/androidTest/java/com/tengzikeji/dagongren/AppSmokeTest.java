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
    private String evaluate(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->((WebView)activity.findViewById(R.id.web_view)).evaluateJavascript(script,value->{result.set(value);latch.countDown();}));
        assertTrue("WebView evaluation timed out",latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void waitTrue(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        long deadline=System.currentTimeMillis()+20000;String last="";
        while(System.currentTimeMillis()<deadline){
            last=evaluate(scenario,script);if("true".equals(last))return;
            Thread.sleep(150);
        }
        screenshot("condition-failed");
        String details=evaluate(scenario,"JSON.stringify({viewport:[innerWidth,innerHeight,visualViewport.height],keyboard:document.body.classList.contains('keyboard-open'),focused:document.activeElement.id,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.motion,introAllowed:AndroidFiles.shouldPlayIntro(),rects:['.modal','.modal-body','.modal-footer','#company-name'].map(s=>{const e=document.querySelector(s);return e?{s,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}:null})})");
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
        scenario.onActivity(activity->{WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();result.set(insets!=null&&insets.isVisible(WindowInsets.Type.ime()));});
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
        screenshot(name);
    }
    @Test public void appLoadsSavesWagesAndOffersEditableConnection() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
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
            paintedScreenshot(scenario,"profile-wrap");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click()");
            JSONObject position=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const r=document.getElementById('company-name').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())")).nextValue().toString());
            int[] location=new int[2];float[] scale=new float[1];
            scenario.onActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(location);scale[0]=activity.getResources().getDisplayMetrics().density;});
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
            evaluate(scenario,"document.querySelector('[data-action=open-cleanup]').click();const s=document.getElementById('cleanup-scope');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-action=review-cleanup]').click();document.querySelector('[data-action=confirm-cleanup]').click()");
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
    @Test public void coldStartupShowsOriginalAnimatedWordmark() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("settings put global window_animation_scale 1");
        device.executeShellCommand("settings put global transition_animation_scale 1");
        device.executeShellCommand("settings put global animator_duration_scale 1");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitTrue(scenario,"Boolean(document.querySelector('.brand-intro svg'))");
            assertEquals("true",evaluate(scenario,"getComputedStyle(document.querySelector(\'.brand-intro path\')).animationName===\'intro-write\'"));
            evaluate(scenario,"document.querySelector(\'.brand-intro\').getAnimations({subtree:true}).forEach(a=>a.finish())");
            paintedScreenshot(scenario,"startup-wordmark");
            waitTrue(scenario,"!document.querySelector('.brand-intro')");
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.bottom-nav'))"));
        } finally {
            device.executeShellCommand("settings put global window_animation_scale 0");
            device.executeShellCommand("settings put global transition_animation_scale 0");
            device.executeShellCommand("settings put global animator_duration_scale 0");
        }
    }

}
