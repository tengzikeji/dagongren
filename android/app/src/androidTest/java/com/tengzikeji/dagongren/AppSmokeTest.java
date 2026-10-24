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
import java.io.File;
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
        fail("Condition did not become true: "+script+"; last result: "+last);
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
    private void screenshot(String name) {
        Context context=ApplicationProvider.getApplicationContext();
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(new File(context.getExternalFilesDir(null),name+".png")));
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
            screenshot("home");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click()");
            evaluate(scenario,"document.querySelector('[data-action=calendar-today]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('[aria-current=date]'))");
            assertEquals("true",evaluate(scenario,"document.querySelector('[aria-current=date]').dataset.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())"));
            screenshot("calendar-today");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click()");
            evaluate(scenario,"document.getElementById('company-name').value='示例科技有限公司·杭州电商运营服务中心';document.querySelector('.modal-footer button[type=submit]').click()");
            waitTrue(scenario,"!document.querySelector('#company-form')");
            assertEquals("true",evaluate(scenario,"document.querySelector('.profile-join').getBoundingClientRect().top>=document.querySelector('.profile-company').getBoundingClientRect().bottom"));
            assertEquals("true",evaluate(scenario,"document.body.scrollWidth<=innerWidth"));
            screenshot("profile-wrap");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click()");
            JSONObject position=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const r=document.getElementById('company-name').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())")).nextValue().toString());
            int[] location=new int[2];float[] scale=new float[1];
            scenario.onActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(location);scale[0]=activity.getResources().getDisplayMetrics().density;});
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            assertTrue(device.click(location[0]+Math.round((float)position.getDouble("x")*scale[0]),location[1]+Math.round((float)position.getDouble("y")*scale[0])));
            long deadline=System.currentTimeMillis()+15000;
            while(!keyboardVisible(scenario)&&System.currentTimeMillis()<deadline)Thread.sleep(150);
            assertTrue("Real Android keyboard did not open",keyboardVisible(scenario));
            waitTrue(scenario,"(()=>{const input=document.activeElement,footer=document.querySelector('.modal-footer'),body=document.querySelector('.modal-body'),modal=document.querySelector('.modal');if(input.id!=='company-name')return false;const r=input.getBoundingClientRect(),f=footer.getBoundingClientRect(),b=body.getBoundingClientRect(),m=modal.getBoundingClientRect(),h=Math.min(innerHeight,visualViewport.height);return r.top>=b.top-1&&r.bottom<=b.bottom+1&&f.bottom<=h+1&&m.top>=8&&m.bottom<=h-8})()");
            assertEquals("true",evaluate(scenario,"document.body.classList.contains('keyboard-open')"));
            screenshot("keyboard-centered");
            device.pressBack();
            deadline=System.currentTimeMillis()+10000;
            while(keyboardVisible(scenario)&&System.currentTimeMillis()<deadline)Thread.sleep(150);
            assertFalse("Keyboard stayed visible",keyboardVisible(scenario));
            evaluate(scenario,"document.querySelector('.modal-footer button[type=submit]').click()");
            waitTrue(scenario,"!document.querySelector('#company-form')");
            screenshot("profile-final");
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
}
