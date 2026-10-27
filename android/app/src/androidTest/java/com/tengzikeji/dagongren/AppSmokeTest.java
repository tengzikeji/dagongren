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
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiObject2;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.Before;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    @org.junit.Rule public final org.junit.rules.Timeout perTestTimeout=org.junit.rules.Timeout.seconds(300);
    private long originalIdleTimeout;
    @org.junit.After public void restoreAnimationTestEnvironment(){androidx.test.uiautomator.Configurator.getInstance().setWaitForIdleTimeout(originalIdleTimeout);}
    @Before public void enableAnimationTestEnvironment() throws Exception {
        originalIdleTimeout=androidx.test.uiautomator.Configurator.getInstance().getWaitForIdleTimeout();
        androidx.test.uiautomator.Configurator.getInstance().setWaitForIdleTimeout(250);
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.wakeUp();
        dismissEmulatorLauncherAnr();
        device.executeShellCommand("settings put global window_animation_scale 1");
        device.executeShellCommand("settings put global transition_animation_scale 1");
        device.executeShellCommand("settings put global animator_duration_scale 1");
    }
    private void dismissEmulatorLauncherAnr() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        if(!"android".equals(device.getCurrentPackageName()))return;
        UiObject2 launcher=device.findObject(By.textContains("Quickstep"));
        if(launcher==null)return;
        UiObject2 close=device.findObject(By.text("Close app"));
        if(close!=null){close.click();device.waitForIdle(1000);System.out.println("Dismissed emulator Quickstep ANR; app assertions remain active.");}
    }
    private boolean withActivity(java.util.function.Consumer<MainActivity> action) {
        java.util.concurrent.atomic.AtomicBoolean found=new java.util.concurrent.atomic.AtomicBoolean(false);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
            MainActivity selected=null;
            for(android.app.Activity activity:androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED)){
                if(activity instanceof MainActivity&&!activity.isFinishing()){
                    if(selected==null)selected=(MainActivity)activity;
                    if(activity.hasWindowFocus()){selected=(MainActivity)activity;break;}
                }
            }
            if(selected!=null){found.set(true);action.accept(selected);}
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
        String details=evaluate(scenario,"JSON.stringify({view:document.querySelector('.bottom-nav [aria-current=page]')?.dataset.view,classes:document.getElementById('app').className,modal:document.getElementById('modal-title')?.textContent,forms:[...document.querySelectorAll('#modal-root form')].map(f=>f.id),pointers:window.__pointerEvents,swipe:window.__lastSwipeTarget,viewport:[innerWidth,innerHeight,visualViewport.height],keyboard:document.body.classList.contains('keyboard-open'),focused:document.activeElement.id,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.motion,introAllowed:AndroidFiles.shouldPlayIntro(),rects:['.modal','.modal-body','.modal-footer','#company-name'].map(s=>{const e=document.querySelector(s);return e?{s,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}:null})})");
        fail("Condition did not become true: "+script+"; last result: "+last+"; "+details);
    }
    private void waitReady(ActivityScenario<MainActivity> scenario) throws Exception {
        waitTrue(scenario,"Boolean(document.querySelector('.bottom-nav'))&&!document.querySelector('.launch-page')&&!document.getElementById('app').inert");
        long deadline=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<deadline){
            AtomicReference<Boolean> ready=new AtomicReference<>(false);
            withActivity(activity->ready.set(activity.isLaunchSurfaceReady()));
            if(ready.get())return;
            Thread.sleep(100);
        }
        fail("Native launch surface did not become interactive");
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
        dismissEmulatorLauncherAnr();
        waitTrue(scenario,"!document.querySelector('.data-chart .number-roll-strip,.calendar-day .number-roll-strip')");
        evaluate(scenario,"window.__captureInfiniteAnimations=document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations===Infinity);for(const a of window.__captureInfiniteAnimations)a.pause();window.__upgradePaintReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__upgradePaintReady=true;}))");
        try{
            waitTrue(scenario,"window.__upgradePaintReady===true");
            CountDownLatch frame=new CountDownLatch(1);
            withActivity(activity->((WebView)activity.findViewById(R.id.web_view)).postVisualStateCallback(1,new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){frame.countDown();}}));
            assertTrue("WebView frame was not committed",frame.await(10,TimeUnit.SECONDS));
            screenshot(name);
        }finally{evaluate(scenario,"for(const a of window.__captureInfiniteAnimations||[])a.play();window.__captureInfiniteAnimations=[]");}
    }

    private void selectCalendarMonth(ActivityScenario<MainActivity> scenario,String month) throws Exception {
        evaluate(scenario,"document.querySelector('[data-action=month-picker]').click();var targetYear=Number('"+month+"'.slice(0,4));for(let n=0;n<25;n++){const current=parseInt(document.querySelector('.month-year span').textContent);if(current===targetYear)break;document.querySelector('[data-action=picker-year][data-delta=\"'+(current>targetYear?'-1':'1')+'\"]').click();}document.querySelector('[data-action=choose-month][data-month=\""+month+"\"]').click()");
    }
    @Test public void cycleWagesChartsAndAdaptiveCalendarMatchLedger() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"const defaults={salaryCents:600001,company:'周期图表验收',joinDate:'2026-09-21',periodMode:'custom',periodStartDay:21,payday:25,motion:true};const r=()=>({...defaults,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[]});const sept=r(),oct=r();sept.payments=[{id:'p',date:'2026-10-22',amountCents:200000,periodStart:'2026-09-21',periodEnd:'2026-10-20'}];sept.advances=[{id:'a',date:'2026-10-22',amountCents:100000,periodStart:'2026-09-21',periodEnd:'2026-10-20'}];oct.leaves=[{id:'l',date:'2026-10-22',days:.5,deduct:true}];oct.overtime=[{id:'o',date:'2026-10-23',mode:'custom',amountCents:8000}];oct.subsidies=[{id:'s',date:'2026-10-23',amountCents:20000,category:'餐补'}];oct.deductions=[{id:'d',date:'2026-10-24',amountCents:3000,category:'住宿费'}];localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults,months:{'2026-09':sept,'2026-10':oct},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            waitTrue(scenario,"Boolean(document.querySelector('.settlement-chart .chart-ring-fill'))");
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            waitTrue(scenario,"[...document.querySelectorAll('.data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-home");
            evaluate(scenario,"document.querySelector('[data-action=home-period-picker]').click();document.querySelector('[data-action=choose-home-period][data-month=\"2026-09\"]').click();document.querySelector('.month-account-head [data-metric=earned]').click()");
            assertEquals("600001",evaluate(scenario,"Number(document.querySelector('.metric-total').dataset.total)"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.metric-scope').textContent.includes('2026/09/21 — 2026/10/20')"));
            evaluate(scenario,"document.querySelector('.modal-close').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('.month-account').dataset.start==='2026-09-21'&&!document.querySelector('.modal')"));

            evaluate(scenario,"document.querySelector('[data-view=records]').click();document.querySelector('.month-pay-card[data-period^=\"2026-09-21|\"]').click();document.querySelector('.period-component-list .sum').click()");
            assertEquals("600001",evaluate(scenario,"Number(document.querySelector('.metric-total').dataset.total)"));
            evaluate(scenario,"globalThis.dagongrenBack();document.querySelector('[data-view=records]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('.annual-chart .wage-plot'))");
            waitTrue(scenario,"[...document.querySelectorAll('.data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-records");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click()");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&Boolean(document.querySelector('.employment-chart'))&&!document.querySelector('.record-mix-chart')");
            waitTrue(scenario,"!document.querySelector('.employment-chart .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"document.querySelectorAll('.employment-metrics [data-stat]').length===3"));
            assertEquals("true",evaluate(scenario,"(()=>{const e=document.querySelector('.employment-chart'),days=Math.round((Date.parse(e.dataset.asOf)-Date.parse('2026-09-21'))/86400000)+1;return parseInt(e.querySelector('[data-stat=days]').textContent)===days})()"));
            waitTrue(scenario,"[...document.querySelectorAll('.data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-profile");
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click()");
            waitTrue(scenario,"document.querySelectorAll('.record-mix-bar .mix-segment').length===6&&!document.querySelector('.employment-chart')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.mix-segment')].reduce((n,e)=>n+Number(e.dataset.count),0)===6&&document.querySelectorAll('.profile-chart-panel').length===1"));
            evaluate(scenario,"document.querySelector('.record-mix-chart').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"charts-profile-records");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            selectCalendarMonth(scenario,"2021-02");
            assertEquals("28",evaluate(scenario,"document.querySelector('.calendar-days').children.length"));
            evaluate(scenario,"window.__fourWeekHeight=document.querySelector('.calendar-days').getBoundingClientRect().height;document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-four-weeks");
            selectCalendarMonth(scenario,"2024-02");
            assertEquals("35",evaluate(scenario,"document.querySelector('.calendar-days').children.length"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-five-weeks");
            selectCalendarMonth(scenario,"2026-08");
            assertEquals("42",evaluate(scenario,"document.querySelector('.calendar-days').children.length"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.calendar-days').getBoundingClientRect().height>window.__fourWeekHeight*1.4"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-six-weeks");
            selectCalendarMonth(scenario,"2026-10");
            waitTrue(scenario,"document.querySelectorAll('.daily-chart .chart-bar').length>0");
            waitTrue(scenario,"!document.querySelector('.calendar-summary .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.daily-chart .chart-bar')].reduce((n,e)=>n+Number(e.dataset.amount),0)===Math.round(Number(document.querySelector('.calendar-summary button strong').textContent.replace(/[^0-9.-]/g,''))*100)"));
            evaluate(scenario,"document.querySelector('.daily-chart').scrollIntoView({block:'start'})");
            waitTrue(scenario,"[...document.querySelectorAll('.data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-calendar");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=toggle-motion]').click();document.querySelector('[data-view=home]').click()");
            assertEquals("\"none\"",evaluate(scenario,"getComputedStyle(document.querySelector('.chart-ring-fill')).animationName"));
        }
    }

    @Test public void everyMainPageReturnsOneLevelOrClosesAllMenus() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"document.querySelector('[data-action=salary-settings]').click();document.getElementById('salary').value='6000';document.querySelector('.modal-footer button[type=submit]').click()");
            for(String main:new String[]{"home","calendar","records","settings"}){
                evaluate(scenario,"document.querySelector('[data-view="+main+"]').click();document.querySelector('[data-action=record-entry]').click();document.querySelector('[data-kind=subsidy]').click();document.getElementById('adjustment-note').value='保留上层草稿';document.querySelector('.select-trigger').click()");
                waitTrue(scenario,"Boolean(document.querySelector('.choice-sheet'))");
                pressAppBack(scenario);
                waitTrue(scenario,"!document.querySelector('.choice-sheet')&&Boolean(document.getElementById('subsidy-form'))");
                assertEquals("\"保留上层草稿\"",evaluate(scenario,"document.getElementById('adjustment-note').value"));
                evaluate(scenario,"document.querySelector('.modal-back').click()");
                waitTrue(scenario,"document.getElementById('modal-title').textContent==='记一笔'");
                pressAppBack(scenario);
                waitTrue(scenario,"!document.querySelector('.modal')&&!document.getElementById('app').inert");
                assertEquals("\""+main+"\"",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view"));
                evaluate(scenario,"document.querySelector('[data-action=record-entry]').click();document.querySelector('[data-kind=subsidy]').click();document.querySelector('.select-trigger').click();document.querySelector('.choice-close').click()");
                waitTrue(scenario,"!document.querySelector('.modal')&&!document.querySelector('.choice-sheet')&&!document.getElementById('app').inert");
                assertEquals("\""+main+"\"",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view"));
            }
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-view=sync]').click();document.querySelector('[data-action=connection-settings]').click()");
            pressAppBack(scenario);waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.sync-hero'))");
            pressAppBack(scenario);waitTrue(scenario,"Boolean(document.querySelector('.profile-card'))");
            evaluate(scenario,"document.querySelector('[data-view=sync]').click();document.querySelector('[data-action=connection-settings]').click();document.querySelector('.modal-close').click()");
            waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.profile-card'))");
            evaluate(scenario,"document.querySelector('[data-action=open-cleanup]').click();document.querySelector('[data-action=review-cleanup]').click()");
            assertEquals("\"确认清理\"",evaluate(scenario,"document.querySelector('[data-action=confirm-cleanup]').textContent"));
            pressAppBack(scenario);waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.cleanup-panel'))");
            evaluate(scenario,"document.querySelector('[data-action=review-cleanup]').click();document.querySelector('.modal-close').click()");
            waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.profile-card'))");
            paintedScreenshot(scenario,"menus-return-profile");
        }
    }

    @Test public void signedCalendarAmountsAndUsageStayAccurate() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var signedDefaults={salaryCents:310000,company:'日历颜色验收',joinDate:'2026-10-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:false};var signedRecord={...signedDefaults,leaves:[{id:'zero',date:'2026-10-03',days:1,deduct:true}],overtime:[],subsidies:[],deductions:[{id:'negative',date:'2026-10-02',amountCents:30000,category:'住宿费'}],advances:[],payments:[],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:signedDefaults,months:{'2026-10':signedRecord},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            selectCalendarMonth(scenario,"2026-10");
            assertEquals("true",evaluate(scenario,"(()=>{const cell=date=>document.querySelector('.calendar-day[data-date=\"'+date+'\"] .day-wage'),rgb=e=>getComputedStyle(e).color.match(/[0-9.]+/g).map(Number),p=cell('2026-10-01'),n=cell('2026-10-02'),z=cell('2026-10-03'),f=cell('2026-10-31'),pc=rgb(p),nc=rgb(n);return Number(p.textContent)===100&&Number(n.textContent)===-200&&Number(z.textContent)===0&&f.textContent==='—'&&pc[1]>pc[0]&&pc[1]>pc[2]&&nc[0]>nc[1]&&nc[0]>nc[2]&&getComputedStyle(z).color===getComputedStyle(f).color&&z.classList.contains('wage-neutral')})()"));
            assertEquals("true",evaluate(scenario,"(()=>{const today=document.querySelector('.calendar-day.today .day-wage');const c=getComputedStyle(today).color.match(/[0-9.]+/g).map(Number);return c[1]>c[0]&&c[1]>c[2]})()"));
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-signed-wages");
            evaluate(scenario,"document.querySelector('[data-action=calendar-sources]').click()");
            assertEquals("true",evaluate(scenario,"(()=>{const t=document.querySelector('.modal-body').textContent;return t.includes('不是当天实际收到的工资')&&t.includes('4、5或6行')&&t.includes('完整工资周期')&&t.includes('未来日期不提前计薪')&&t.includes('修改默认开关不会改动旧记录')})()"));
            paintedScreenshot(scenario,"calendar-usage");
            evaluate(scenario,"document.querySelector('[data-action=calendar-rights]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.modal-body').textContent.includes('本测试版')&&!document.querySelector('[name=accterm]')"));
            evaluate(scenario,"document.querySelector('.modal-back').click()");
            assertEquals("\"日历使用说明\"",evaluate(scenario,"document.getElementById('modal-title').textContent"));
            evaluate(scenario,"document.querySelector('.modal-close').click()");
            waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.calendar-panel'))");
        }
    }

    private String rollingLayoutCheck(String selector) {
        return "(()=>{const numbers=[...document.querySelectorAll('"+selector+"')];return numbers.length===2&&numbers.some(n=>n.querySelectorAll('.number-roll-slot').length>1)&&numbers.every(n=>{const slots=[...n.querySelectorAll('.number-roll-slot')];return slots.length>0&&slots.every(s=>getComputedStyle(s).display==='inline-block'&&getComputedStyle(s).fontSize===getComputedStyle(n).fontSize&&Math.abs(s.getBoundingClientRect().top-slots[0].getBoundingClientRect().top)<1)})})()";
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
            awaitInputWindow(scenario);
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
            vault.clear();
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                resetBook(scenario);
                evaluate(scenario,"const b=JSON.parse(localStorage.getItem('dagongren.paybook.v1'));b.sync.auto=false;localStorage.setItem('dagongren.paybook.v1',JSON.stringify(b))");
                vault.save(config.put("url","https://example.invalid/dav/"));scenario.recreate();waitReady(scenario);
                evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=open-cleanup]').click()");
                assertEquals("true",evaluate(scenario,"!document.getElementById('cleanup-include-cloud').checked&&!document.getElementById('cleanup-include-cloud').disabled"));
                evaluate(scenario,"document.getElementById('cleanup-include-cloud').click()");
                assertEquals("true",evaluate(scenario,"document.getElementById('cleanup-include-cloud').checked&&document.querySelector('.cleanup-page-title h2').textContent==='清理本机及云端'"));
                paintedScreenshot(scenario,"cleanup-cloud-option");
                evaluate(scenario,"document.getElementById('cleanup-include-cloud').click()");
                assertEquals("false",evaluate(scenario,"document.getElementById('cleanup-include-cloud').checked"));
                assertEquals("true",evaluate(scenario,"document.querySelector('[data-action=export]').textContent.trim()==='导出账本'"));
            }
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
            assertEquals("true",evaluate(scenario,"!document.getElementById('cleanup-include-cloud').checked&&document.getElementById('cleanup-include-cloud').disabled"));
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
        try(ActivityScenario<MainActivity> prepared=ActivityScenario.launch(MainActivity.class)){
            resetBook(prepared);
            waitTrue(prepared,"!matchMedia('(prefers-reduced-motion: reduce)').matches");
        }
        device.executeShellCommand("mkdir -p /sdcard/Download/dagongren-test");
        long recordingStarted=System.currentTimeMillis();
        Thread recording=new Thread(()->{try{device.executeShellCommand("screenrecord --size 720x1280 --bit-rate 2000000 --time-limit 30 /sdcard/Download/dagongren-test/startup-transition.mp4");}catch(Exception ignored){}},"startup-recording");recording.setDaemon(true);recording.start();
        ActivityScenario<MainActivity> scenario=null;
        android.content.Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        target.startActivity(new android.content.Intent(target,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK));
        try{
            waitTrue(scenario,"(()=>{const entry=performance.getEntriesByName('dagongren.launch.playing').at(-1);if(!entry)return false;window.__launchObserved=entry.detail;if(!window.__launchFrameWatching){window.__launchFrameWatching=true;window.__launchBlendSamples=[];const sample=()=>{const page=document.querySelector('.launch-page');if(!page)return;if(page.dataset.phase==='absorbing'){const rect=page.getBoundingClientRect();window.__launchBlendSamples.push({opacity:Number(getComputedStyle(document.getElementById('app')).opacity),width:rect.width,height:rect.height})}requestAnimationFrame(sample)};requestAnimationFrame(sample)}return true})()");
            assertEquals("1",evaluate(scenario,"window.__launchObserved.surfaces"));
            assertEquals("false",evaluate(scenario,"window.__launchObserved.oldBrand"));
            assertEquals("true",evaluate(scenario,"window.__launchObserved.inert"));
            assertEquals("true",evaluate(scenario,"window.__launchObserved.animated"));
            assertEquals("true",evaluate(scenario,"(()=>{const created=performance.getEntriesByName('dagongren.launch.created')[0],painted=performance.getEntriesByName('dagongren.launch.painted')[0],render=performance.getEntriesByName('dagongren.app.render')[0],playing=performance.getEntriesByName('dagongren.launch.playing')[0];return !!created&&!!painted&&!!render&&created.startTime<=painted.startTime&&painted.startTime<render.startTime&&render.startTime<playing.startTime})()"));
            double playingSecond=(Double.parseDouble(evaluate(scenario,"window.__launchObserved.at"))-recordingStarted)/1000.0;
            android.util.Log.i("DagongrenLaunchReview","PLAYING_SECOND="+playingSecond);
            waitTrue(scenario,"window.__launchBlendSamples.some(frame=>frame.opacity>0&&frame.opacity<1&&frame.width<innerWidth&&frame.height<innerHeight)");
            paintedScreenshot(scenario,"startup-interface");
            waitTrue(scenario,"!document.querySelector('.launch-page')");
            double absorbingSecond=(Double.parseDouble(evaluate(scenario,"performance.timeOrigin+performance.getEntriesByName('dagongren.launch.absorbing').at(-1).startTime"))-recordingStarted)/1000.0;
            android.util.Log.i("DagongrenLaunchReview","ABSORBING_SECOND="+absorbingSecond);
            assertEquals("true",evaluate(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.launch.absorbing').at(-1)?.detail;return !!d&&d.duration===760&&d.hold===1700&&d.surfaces===1&&d.button&&Math.abs(d.target.x-(d.button.left+d.button.width/2))<1&&Math.abs(d.target.y-(d.button.top+d.button.height/2))<1&&Math.abs(parseFloat(d.origin)-d.target.x)<1&&Math.abs(parseFloat(d.origin.split(' ')[1])-d.target.y)<1&&d.target.x<innerWidth/3&&d.target.y>innerHeight*.8})()"));
            assertEquals("false",evaluate(scenario,"document.getElementById('app').inert"));
            assertEquals("\"none\"",evaluate(scenario,"getComputedStyle(document.getElementById('view-content')).animationName"));
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.bottom-nav'))"));
            waitTrue(scenario,"performance.getEntriesByName('dagongren.home.glare').length===1");
            assertEquals("true",evaluate(scenario,"(()=>{const glare=performance.getEntriesByName('dagongren.home.glare')[0],launch=performance.getEntriesByName('dagongren.launch.absorbing').at(-1);return performance.getEntriesByName('dagongren.home.self-check').length===0&&glare.detail.afterLaunch&&glare.detail.rolling===0&&glare.detail.runs===1&&glare.detail.direction==='left-to-right'&&glare.detail.duration===1000&&glare.detail.from.includes('skewX(-25deg)')&&glare.startTime>=launch.startTime+launch.detail.duration&&glare.startTime<launch.startTime+launch.detail.duration+250})()"));
            evaluate(scenario,"window.__selfCheckBook=localStorage.getItem('dagongren.paybook.v1')");
            double glareSecond=(Double.parseDouble(evaluate(scenario,"performance.getEntriesByName('dagongren.home.glare')[0].detail.at"))-recordingStarted)/1000.0;
            android.util.Log.i("DagongrenLaunchReview","GLARE_SECOND="+glareSecond);
            waitTrue(scenario,"performance.getEntriesByName('dagongren.home.glare.complete').length===1&&!document.querySelector('.hero-startup-glare')");
            paintedScreenshot(scenario,"startup-home");
            device.pressHome();
            target.startActivity(new android.content.Intent(target,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
            waitTrue(scenario,"Boolean(document.querySelector('.view-home'))&&!document.querySelector('.launch-page')&&!document.getElementById('app').inert");
            awaitInputWindow(scenario);dismissEmulatorLauncherAnr();
            assertEquals("true",evaluate(scenario,"performance.getEntriesByName('dagongren.home.self-check').length===0&&performance.getEntriesByName('dagongren.home.glare').length===1&&performance.getEntriesByName('dagongren.home.glare.complete').length===1&&localStorage.getItem('dagongren.paybook.v1')===window.__selfCheckBook"));
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
    private void pressAppBack(ActivityScenario<MainActivity> scenario) throws Exception {
        awaitInputWindow(scenario);
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
    }

    private void awaitInputWindow(ActivityScenario<MainActivity> scenario) throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        String expected=InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName();
        long deadline=System.currentTimeMillis()+15000;
        while(System.currentTimeMillis()<deadline){
            dismissEmulatorLauncherAnr();
            java.util.concurrent.atomic.AtomicBoolean focused=new java.util.concurrent.atomic.AtomicBoolean(false);
            withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);focused.set(activity.hasWindowFocus()&&web.hasWindowFocus()&&web.isShown());});
            if(focused.get()&&expected.equals(device.getCurrentPackageName())){
                CountDownLatch frame=new CountDownLatch(1);
                withActivity(activity->((WebView)activity.findViewById(R.id.web_view)).postVisualStateCallback(2,new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){frame.countDown();}}));
                if(frame.await(8,TimeUnit.SECONDS)){
                    device.waitForIdle(1000);
                    if(expected.equals(device.getCurrentPackageName()))return;
                }
            }
            Thread.sleep(100);
        }
        fail("Application window did not become ready for native input; active package="+device.getCurrentPackageName());
    }

    private void swipeRegion(ActivityScenario<MainActivity> scenario,String selector,int direction) throws Exception {
        waitTrue(scenario,"Boolean(document.querySelector('"+selector+"'))");
        evaluate(scenario,"document.querySelector('"+selector+"').scrollIntoView({block:'center',behavior:'instant'})");
        awaitInputWindow(scenario);
        Thread.sleep(250);
        evaluate(scenario,"window.__pointerEvents=[];if(!window.__pointerEventsInstalled){window.__pointerEventsInstalled=true;for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{if(window.__pointerEvents.length<80)window.__pointerEvents.push({type:e.type,x:e.clientX??e.touches?.[0]?.clientX??e.changedTouches?.[0]?.clientX,y:e.clientY??e.touches?.[0]?.clientY??e.changedTouches?.[0]?.clientY,t:e.timeStamp,target:e.target.tagName});},true);}");
        JSONObject rect=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const node=document.querySelector('"+selector+"'),r=node.getBoundingClientRect(),header=node.closest('[data-calendar-swipe]')?.querySelector('.calendar-panel-header')?.getBoundingClientRect(),top=Math.max(8,r.top,header?.bottom||0),bottom=Math.min(r.bottom,visualViewport.height-100);if(bottom-top<8)throw Error('Swipe region is outside visible page');return window.__lastSwipeTarget={left:Math.max(12,r.left),top,width:Math.min(r.right,innerWidth-12)-Math.max(12,r.left),bottom,y:top+(bottom-top)*.6}})())")).nextValue().toString());
        int[] origin=new int[2];float[] density=new float[1];
        assertTrue("App window is not resumed before swipe",withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(origin);density[0]=activity.getResources().getDisplayMetrics().density;}));
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
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click();const d=new Date();d.setUTCMonth(0,1);d.setUTCFullYear(d.getUTCFullYear()-1);document.getElementById('join-date').value=d.toISOString().slice(0,10);document.querySelector('.modal-footer button[type=submit]').click();document.querySelector('[data-view=home]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();Boolean(document.querySelector('.number-roll-strip')) && [...document.querySelectorAll('.number-roll-strip')].every(e=>Number(e.style.getPropertyValue('--roll-steps'))>0&&Number(e.style.getPropertyValue('--roll-steps'))<=19)"));
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            waitTrue(scenario,"!document.querySelector('.number-roll-strip')");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();window.__calendarHeight=document.querySelector('.calendar-days').getBoundingClientRect().height;for(let i=0;i<5;i++)document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();for(let i=0;i<5;i++)document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            assertEquals("true",evaluate(scenario,"(()=>{const m=document.querySelector('[data-calendar-month]').dataset.calendarMonth,[y,n]=m.split('-').map(Number),first=(new Date(Date.UTC(y,n-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(y,n,0)).getUTCDate();return document.querySelector('.calendar-days').children.length===Math.ceil((first+days)/7)*7})()"));
            assertEquals("true",evaluate(scenario,"Math.abs(document.querySelector('.calendar-days').getBoundingClientRect().height-window.__calendarHeight)<1"));
            waitTrue(scenario,"!document.querySelector('.calendar-day .number-roll-strip')");
            assertEquals("0",evaluate(scenario,"document.querySelectorAll('.calendar-day .number-roll-strip').length"));
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.calendar-day[data-date]')].every(e=>Number(e.dataset.date.slice(8))===Number(e.querySelector('.day-number').childNodes[0].nodeValue))"));
            assertEquals("true",evaluate(scenario,"document.querySelector('[data-action=calendar-today]').click();document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click();document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();"+rollingLayoutCheck(".calendar-summary .number")));
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.calendar-panel-header .month-display'))"));
            evaluate(scenario,"window.__beforeSwipe=document.querySelector('.month-display').textContent");
            swipeCalendar(scenario,1);
            waitTrue(scenario,"document.querySelector('.month-display').textContent!==window.__beforeSwipe");
            assertEquals("false",evaluate(scenario,"Boolean(document.getElementById('modal-root').firstElementChild)"));
            assertEquals("true",evaluate(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.calendar.slide').at(-1)?.detail;return !!d&&d.direction===1&&d.duration===280&&d.to===document.querySelector('[data-calendar-month]').dataset.calendarMonth})()"));
            swipeCalendar(scenario,-1);
            waitTrue(scenario,"document.querySelector('.month-display').textContent===window.__beforeSwipe");
            swipeCalendar(scenario,0);
            assertEquals("true",evaluate(scenario,"document.querySelector('.month-display').textContent===window.__beforeSwipe"));
            paintedScreenshot(scenario,"calendar-stable");
            evaluate(scenario,"document.querySelector('[data-view=records]').click();document.querySelector('[data-action=record-year-picker]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('.record-year-options'))");
            paintedScreenshot(scenario,"record-year-picker");
            assertEquals("true",evaluate(scenario,"document.querySelector('.record-year-option[aria-pressed=false]').click();"+rollingLayoutCheck(".ledger-secondary .number")));
            evaluate(scenario,"document.querySelector('[data-action=detail-tab][data-tab=entries]').click()");
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
            evaluate(scenario,"window.__persistentNav=document.querySelector('.bottom-nav');window.__persistentLauncher=document.querySelector('.record-launcher')");
            paintedScreenshot(scenario,"page-swipe-ready");
            for(String next:new String[]{"calendar","records","settings"}){
                swipeRegion(scenario,".topbar",1);
                waitTrue(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='"+next+"'&&!document.getElementById('app').classList.contains('page-transitioning')");
            }
            assertEquals("true",evaluate(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.page.slide').at(-1)?.detail;return !!d&&d.to==='settings'&&d.direction===1&&d.duration===280})()"));
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
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav')===window.__persistentNav&&document.querySelector('.record-launcher')===window.__persistentLauncher"));
            assertEquals("true",evaluate(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.page.slide').at(-1)?.detail;return !!d&&d.to==='home'&&d.direction===-1&&d.duration===280})()"));
            swipeRegion(scenario,".topbar",-1);
            assertEquals("\"home\"",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view"));
        } finally {
            device.executeShellCommand("settings put global window_animation_scale 0");
            device.executeShellCommand("settings put global transition_animation_scale 0");
            device.executeShellCommand("settings put global animator_duration_scale 0");
        }
    }



    @Test public void pagePushHasNoTrailingEdgeOrNavigationFlash() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            assertEquals("true",evaluate(scenario,"window.__reviewPush=(selector,delta,type)=>{\n const host=document.querySelector(selector),r=host.getBoundingClientRect(),viewport=type==='page'?document.documentElement:host.closest('.calendar-grid-viewport'),width=viewport.clientWidth,x=innerWidth*.5,y=Math.max(5,Math.min(innerHeight-120,r.top+25));\n const dispatch=(name,x,t)=>{const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerId:709,pointerType:'mouse',isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});host.dispatchEvent(e);};\n const nav=document.querySelector('.bottom-nav'),navRect=nav.getBoundingClientRect();dispatch('pointerdown',x,1000);dispatch('pointermove',x-delta*width*.55,2000);dispatch('pointerup',x-delta*width*.55,2400);\n const track=document.querySelector(type==='page'?'.page-swipe-track':'.calendar-swipe-track');if(!track)return false;\n const a=track.getAnimations()[0],out=track.children[0],next=track.children[1];if(!a)return false;a.pause();let samples=[];\n for(const progress of [0,.25,.5,.75,1]){a.currentTime=a.effect.getTiming().duration*progress;\n  const o=out.getBoundingClientRect(),n=next.getBoundingClientRect(),bar=nav.getBoundingClientRect(),v=type==='page'?{left:0,right:innerWidth}:viewport.getBoundingClientRect();\n  samples.push({progress,gap:Math.abs((n.left-o.left)-delta*width),navStable:document.querySelector('.bottom-nav')===nav&&Math.abs(bar.top-navRect.top)<.5&&getComputedStyle(nav).opacity==='1'&&getComputedStyle(nav).visibility==='visible'&&getComputedStyle(nav).backdropFilter==='none',transparent:[...track.querySelectorAll('.balance-primary,.balance-primary .number,.balance-primary .number span')].every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'),end:progress!==1||(Math.abs(n.left-v.left)<.6&&(delta>0?o.right<=v.left+.6:o.left>=v.right-.6)),navOutside:type!=='page'||track.parentElement.getBoundingClientRect().bottom<=navRect.top+.6});\n }\n window.__pushSamples=samples;window.__heldPush=a;window.__heldHeight=null;a.currentTime=a.effect.getTiming().duration*.5;\n return samples.every(s=>s.gap<.6&&s.navStable&&s.transparent&&s.end&&s.navOutside);\n};true"));
            for(String theme:new String[]{"light","dark"}){
                evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme="+theme+"]').click();document.querySelector('[data-view=home]').click();window.scrollTo(0,0)");
                waitTrue(scenario,"!document.getElementById('app').classList.contains('page-transitioning')");
                for(int direction:new int[]{1,-1})for(int step=0;step<3;step++){
                    String diagnostic=evaluate(scenario,"window.__reviewPush('.topbar',"+direction+",'page');JSON.stringify(window.__pushSamples)");
                    assertEquals(diagnostic,"true",evaluate(scenario,"window.__pushSamples.every(s=>s.gap<.6&&s.navStable&&s.transparent&&s.end&&s.navOutside)"));
                    if(direction==1&&((step==0&&theme.equals("light"))||(step==2&&theme.equals("dark"))))paintedScreenshot(scenario,"push-"+theme+"-"+step);
                    evaluate(scenario,"window.__heldPush.finish()");
                    waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&!document.getElementById('app').classList.contains('page-transitioning')&&getComputedStyle(document.querySelector('.workspace .content')).visibility==='visible'");
                }
                assertEquals("true",evaluate(scenario,"(()=>{const b=document.querySelector('.balance-primary');return !!b&&[b,b.querySelector('strong'),...b.querySelectorAll('.number-roll-anchor,.number-roll,.number-roll-slot,.number-roll-strip')].every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)')})()"));
            }
        }
    }

    @Test public void calendarPushFinishesTogetherAcrossFourFiveSixWeeks() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();document.querySelector('[data-action=month-picker]').click();while(!document.querySelector('[data-action=choose-month][data-month=\"2027-02\"]')){const y=parseInt(document.querySelector('.month-year>span').textContent);document.querySelector('[data-action=picker-year][data-delta=\"'+(y<2027?1:-1)+'\"]').click()}document.querySelector('[data-action=choose-month][data-month=\"2027-02\"]').click()");
            assertEquals("28",evaluate(scenario,"document.querySelector('.calendar-days').children.length"));
            assertEquals("true",evaluate(scenario,"window.__reviewPush=(selector,delta,type)=>{\n const host=document.querySelector(selector),r=host.getBoundingClientRect(),viewport=type==='page'?document.documentElement:host.closest('.calendar-grid-viewport'),width=viewport.clientWidth,x=innerWidth*.5,y=Math.max(5,Math.min(innerHeight-120,r.top+25));\n const dispatch=(name,x,t)=>{const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerId:709,pointerType:'mouse',isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});host.dispatchEvent(e);};\n const nav=document.querySelector('.bottom-nav'),navRect=nav.getBoundingClientRect();dispatch('pointerdown',x,1000);dispatch('pointermove',x-delta*width*.55,2000);dispatch('pointerup',x-delta*width*.55,2400);\n const track=document.querySelector(type==='page'?'.page-swipe-track':'.calendar-swipe-track');if(!track)return false;\n const a=track.getAnimations()[0],out=track.children[0],next=track.children[1];if(!a)return false;a.pause();let samples=[];\n for(const progress of [0,.25,.5,.75,1]){a.currentTime=a.effect.getTiming().duration*progress;\n  const o=out.getBoundingClientRect(),n=next.getBoundingClientRect(),bar=nav.getBoundingClientRect(),v=type==='page'?{left:0,right:innerWidth}:viewport.getBoundingClientRect();\n  samples.push({progress,gap:Math.abs((n.left-o.left)-delta*width),navStable:document.querySelector('.bottom-nav')===nav&&Math.abs(bar.top-navRect.top)<.5&&getComputedStyle(nav).opacity==='1'&&getComputedStyle(nav).visibility==='visible'&&getComputedStyle(nav).backdropFilter==='none',transparent:[...track.querySelectorAll('.balance-primary,.balance-primary .number,.balance-primary .number span')].every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'),end:progress!==1||(Math.abs(n.left-v.left)<.6&&(delta>0?o.right<=v.left+.6:o.left>=v.right-.6)),navOutside:type!=='page'||track.parentElement.getBoundingClientRect().bottom<=navRect.top+.6});\n }\n window.__pushSamples=samples;window.__heldPush=a;window.__heldHeight=null;a.currentTime=a.effect.getTiming().duration*.5;\n return samples.every(s=>s.gap<.6&&s.navStable&&s.transparent&&s.end&&s.navOutside);\n};true"));
            for(int direction:new int[]{1,1,1,-1,-1,-1}){
                evaluate(scenario,"document.querySelector('.calendar-grid-viewport').scrollIntoView({block:'center',behavior:'instant'})");
                String diagnostic=evaluate(scenario,"window.__reviewPush('.calendar-days',"+direction+",'calendar');JSON.stringify(window.__pushSamples)");
                assertEquals(diagnostic,"true",evaluate(scenario,"window.__pushSamples.every(s=>s.gap<.6&&s.navStable&&s.end)"));
                evaluate(scenario,"window.__heldPush.finish();window.__heldHeight?.finish()");
                waitTrue(scenario,"!document.querySelector('.calendar-swipe-track')&&getComputedStyle(document.querySelector('.calendar-days')).visibility==='visible'");
                assertEquals("true",evaluate(scenario,"(()=>{const p=document.querySelector('.calendar-grid-viewport'),g=p.querySelector('.calendar-days');return Math.abs(p.getBoundingClientRect().height-g.getBoundingClientRect().height)<.6&&[28,35,42].includes(g.children.length)&&!g.querySelector('.number-roll-strip')})()"));
            }
            paintedScreenshot(scenario,"calendar-four-weeks");
        }
    }


    @Test public void cloudCleanupReviewKeepsOneDialogThroughFastResponse() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            final String injection="(()=>{const real=window.AndroidFiles;window.__cloudWrites=0;window.__cloudReads=0;window.AndroidFiles={shouldPlayIntro:()=>false,introReady:()=>real.introReady(),introStyle:v=>real.introStyle(v),systemDark:()=>real.systemDark(),themeStyle:v=>real.themeStyle(v),fingerprint:v=>real.fingerprint(v),status:()=>JSON.stringify({configured:true,username:'motion-review@example.invalid',path:'打工人/工资账本.json'}),request(id,action){if(action==='read'){window.__cloudReads++;const book=JSON.parse(localStorage.getItem('dagongren.paybook.v1'));setTimeout(()=>globalThis.dagongrenNativeResult(id,{ok:true,data:{exists:true,etag:'\"review-only\"',envelope:{format:'dagongren.webdav.v2',book}}}),20);return;}if(action==='write'){window.__cloudWrites++;throw Error('Review must never write');}setTimeout(()=>globalThis.dagongrenNativeResult(id,{ok:false,error:'测试未读取外部数据'}),0);}};})()";
            withActivity(activity->{try{
                String source=new String(activity.getAssets().open("www/index.html").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
                final byte[] html=source.replace("<script type=\"module\"", "<script>"+injection+"</script><script type=\"module\"").getBytes(java.nio.charset.StandardCharsets.UTF_8);
                WebView web=activity.findViewById(R.id.web_view);android.webkit.WebViewClient original=web.getWebViewClient();
                web.setWebViewClient(new android.webkit.WebViewClient(){
                    @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,android.webkit.WebResourceRequest request){
                        if(request.isForMainFrame()&&"/assets/www/index.html".equals(request.getUrl().getPath()))return new android.webkit.WebResourceResponse("text/html","UTF-8",new java.io.ByteArrayInputStream(html));
                        return original.shouldInterceptRequest(view,request);
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest request){return original.shouldOverrideUrlLoading(view,request);}
                    @Override public void onPageFinished(WebView view,String url){original.onPageFinished(view,url);}
                });
                web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html?review=cloud");
            }catch(Exception error){throw new RuntimeException(error);}});
            waitReady(scenario);
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=open-cleanup]').click();document.getElementById('cleanup-include-cloud').click();window.__cleanupBook=localStorage.getItem('dagongren.paybook.v1');document.querySelector('[data-action=review-cleanup]').click();window.__cloudOverlay=document.querySelector('.modal-overlay');window.__cloudDialog=document.querySelector('.modal');window.__cloudHeight=window.__cloudDialog.offsetHeight;window.__cloudLoadingAtClick=Boolean(document.getElementById('cloud-cleanup-loading'))&&document.getElementById('cloud-cleanup-confirm').disabled;window.__cloudAdditions=0;window.__cloudObserver=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.matches?.('.modal-overlay,.modal'))window.__cloudAdditions++});window.__cloudObserver.observe(document.getElementById('modal-root'),{subtree:true,childList:true})");
            assertEquals("true",evaluate(scenario,"window.__cloudLoadingAtClick"));
            waitTrue(scenario,"!document.getElementById('cloud-cleanup-loading')&&!document.getElementById('cloud-cleanup-confirm').disabled");
            assertEquals("true",evaluate(scenario,"(()=>{const m=document.querySelector('.modal'),r=m.getBoundingClientRect();return m===window.__cloudDialog&&document.querySelector('.modal-overlay')===window.__cloudOverlay&&window.__cloudAdditions===0&&Math.abs(m.offsetHeight-window.__cloudHeight)<3&&getComputedStyle(window.__cloudOverlay).backdropFilter==='none'&&window.__cloudReads===1&&window.__cloudWrites===0&&localStorage.getItem('dagongren.paybook.v1')===window.__cleanupBook})()"));
            paintedScreenshot(scenario,"cloud-cleanup-stable-review");
            evaluate(scenario,"window.__cloudObserver.disconnect();document.querySelector('.modal-close').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.modal')&&window.__cloudWrites===0&&localStorage.getItem('dagongren.paybook.v1')===window.__cleanupBook"));
        }
    }


    @Test public void navigationTapsPushOnceAndRapidTapsReachLastPage() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"window.__tapNav=document.querySelector('.bottom-nav')");
            for(String next:new String[]{"calendar","settings","records","home"}){
                assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav [data-view="+next+"]').click();(()=>{const d=performance.getEntriesByName('dagongren.page.slide').at(-1)?.detail,t=document.querySelector('.page-swipe-track');return d?.trigger==='tap'&&d.to==='"+next+"'&&d.duration===280&&d.sharedTrack&&!!t&&t.getAnimations().length===1&&document.querySelector('.bottom-nav')===window.__tapNav})()"));
                waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&getComputedStyle(document.querySelector('.workspace .content')).visibility==='visible'");
            }
            evaluate(scenario,"document.querySelector('.bottom-nav [data-view=calendar]').click();document.querySelector('.bottom-nav [data-view=records]').click();document.querySelector('.bottom-nav [data-view=settings]').click()");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='settings'&&getComputedStyle(document.querySelector('.workspace .content')).visibility==='visible'");
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav')===window.__tapNav"));
        }
    }


    private void nextGestureFrames(ActivityScenario<MainActivity> scenario) throws Exception {
        evaluate(scenario,"window.__nextFrames()");waitTrue(scenario,"window.__framesReady");
    }
    @Test public void continuousPageDragLocksAxisAndReboundsWithoutChangingBook() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);assertEquals("true",evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true"));
            evaluate(scenario,"window.__gestureBook=localStorage.getItem('dagongren.paybook.v1');window.__barTop=document.querySelector('.bottom-nav').getBoundingClientRect().top;window.__dragInput('pointerdown',innerWidth*.8,100,0,'.topbar');window.__dragInput('pointermove',innerWidth*.6,102,1000)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"(()=>{const t=document.querySelector('.page-swipe-track'),a=t.children[0].getBoundingClientRect(),b=t.children[1].getBoundingClientRect(),m=new DOMMatrix(getComputedStyle(t).transform),p=Number(document.querySelector('.bottom-nav').dataset.swipeProgress);return Math.abs(m.m41+innerWidth*.2)<.6&&Math.abs(a.right-b.left)<.6&&Math.abs(p-.2)<.01&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='home'&&Math.abs(document.querySelector('.bottom-nav').getBoundingClientRect().top-window.__barTop)<.1})()"));
            evaluate(scenario,"window.__dragInput('pointermove',innerWidth*.59,350,1100)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.page-swipe-track')).transform).m41+innerWidth*.21)<.6"));
            evaluate(scenario,"window.__dragInput('pointerup',innerWidth*.59,350,1500)");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            assertEquals("true",evaluate(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.page.rebound').at(-1)?.detail;return d?.duration===200&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='home'&&getComputedStyle(document.querySelector('.workspace .content')).visibility==='visible'&&localStorage.getItem('dagongren.paybook.v1')===window.__gestureBook})()"));
            evaluate(scenario,"window.__dragInput('pointerdown',300,100,2000,'.topbar');window.__dragInput('pointermove',302,160,2050);window.__dragInput('pointermove',80,165,2100);window.__dragInput('pointerup',80,165,2150)");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='home'"));
        }
    }
    @Test public void shortFastFlickAndBoundaryDampingStayAdjacent() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);assertEquals("true",evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true"));
            evaluate(scenario,"window.__dragInput('pointerdown',250,100,0,'.topbar');window.__dragInput('pointermove',210,102,40);window.__dragInput('pointerup',210,102,50)");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='calendar'");
            evaluate(scenario,"window.__dragInput('pointerdown',innerWidth*.8,100,1000,'.topbar');window.__dragInput('pointermove',-innerWidth*1.2,100,2000)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.page-swipe-track')).transform).m41+innerWidth)<.6&&document.querySelectorAll('.page-swipe-track>.swipe-page').length===2"));
            evaluate(scenario,"window.__dragInput('pointerup',-innerWidth*1.2,100,2400)");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='records'");
            evaluate(scenario,"document.querySelector('.bottom-nav [data-view=settings]').click()");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            evaluate(scenario,"window.__dragInput('pointerdown',250,100,3000,'.topbar');window.__dragInput('pointermove',150,100,4000)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.page-swipe-track')).transform).m41+40)<.6"));
            evaluate(scenario,"window.__dragInput('pointerup',150,100,4500)");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='settings'&&performance.getEntriesByName('dagongren.page.rebound').at(-1).detail.boundary"));
            evaluate(scenario,"document.querySelector('.bottom-nav [data-view=home]').click()");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            evaluate(scenario,"window.__dragInput('pointerdown',150,100,5000,'.topbar');window.__dragInput('pointermove',250,100,6000)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.page-swipe-track')).transform).m41-40)<.6"));
            evaluate(scenario,"window.__dragInput('pointerup',250,100,6500)");waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='home'"));
        }
    }
    @Test public void calendarDateAreaFollowsFingerAndInterpolatesHeight() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);assertEquals("true",evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true"));
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();document.querySelector('[data-action=month-picker]').click();while(!document.querySelector('[data-action=choose-month][data-month=\"2027-02\"]')){const y=parseInt(document.querySelector('.month-year>span').textContent);document.querySelector('[data-action=picker-year][data-delta=\"'+(y<2027?1:-1)+'\"]').click()}document.querySelector('[data-action=choose-month][data-month=\"2027-02\"]').click()");
            evaluate(scenario,"window.__dragInput('pointerdown',250,200,0,'.calendar-panel-header');window.__dragInput('pointermove',50,200,1000);window.__dragInput('pointerup',50,200,1400)");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.calendar-swipe-track')&&document.querySelector('[data-calendar-month]').dataset.calendarMonth==='2027-02'"));
            evaluate(scenario,"window.__monthWidth=document.querySelector('.calendar-grid-viewport').clientWidth;window.__monthHeight=document.querySelector('.calendar-grid-viewport').getBoundingClientRect().height;window.__dragInput('pointerdown',250,300,2000,'.calendar-days');window.__dragInput('pointermove',250-window.__monthWidth*.5,300,3000)");nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"(()=>{const p=document.querySelector('.calendar-grid-viewport'),t=p.querySelector('.calendar-swipe-track'),a=t.children[0].getBoundingClientRect(),b=t.children[1].getBoundingClientRect(),next=t.children[1].querySelector('.calendar-days').getBoundingClientRect().height;return Math.abs(new DOMMatrix(getComputedStyle(t).transform).m41+window.__monthWidth*.5)<.6&&Math.abs(a.right-b.left)<.6&&Math.abs(p.getBoundingClientRect().height-(window.__monthHeight+next)/2)<.7&&document.querySelector('[data-calendar-month]').dataset.calendarMonth==='2027-02'})()"));
            paintedScreenshot(scenario,"calendar-live-half-height");
            evaluate(scenario,"window.__dragInput('pointermove',250-window.__monthWidth*.2,300,4000);window.__dragInput('pointerup',250-window.__monthWidth*.2,300,4500)");waitTrue(scenario,"!document.querySelector('.calendar-swipe-track')");
            assertEquals("true",evaluate(scenario,"Math.abs(document.querySelector('.calendar-grid-viewport').getBoundingClientRect().height-window.__monthHeight)<.6&&document.querySelector('[data-calendar-month]').dataset.calendarMonth==='2027-02'"));
            evaluate(scenario,"window.__dragInput('pointerdown',250,300,5000,'.calendar-days');window.__dragInput('pointermove',210,300,5040);window.__dragInput('pointerup',210,300,5050)");waitTrue(scenario,"!document.querySelector('.calendar-swipe-track')&&document.querySelector('[data-calendar-month]').dataset.calendarMonth==='2027-03'");
            assertEquals("true",evaluate(scenario,"document.querySelector('.calendar-days').children.length===35&&!document.querySelector('.calendar-day .number-roll-strip')"));
        }
    }
    @Test public void swipedChartsAnimateAndHomeCanReturnToCurrentMonth() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);assertEquals("true",evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true"));
            evaluate(scenario,"document.querySelector('.view-home [data-action=shift-month][data-delta=\"-1\"]').click();window.__beforeReturnBook=localStorage.getItem('dagongren.paybook.v1');document.querySelector('[data-action=home-current]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('.view-home .month-display').textContent.includes(new Date().getFullYear()+'年')&&document.querySelector('.view-home .month-display').textContent.includes((new Date().getMonth()+1)+'月')&&localStorage.getItem('dagongren.paybook.v1')===window.__beforeReturnBook"));
            evaluate(scenario,"window.__swipeChartSnapshot=null;window.__dragInput('pointerdown',300,100,0,'.topbar');window.__dragInput('pointermove',100,100,1000);window.__dragInput('pointerup',100,100,1400);document.querySelector('.page-swipe-track').getAnimations()[0].finished.then(()=>{window.__swipeChartSnapshot={count:document.querySelectorAll('#app .data-chart .number-roll-strip').length,view:document.querySelector('.bottom-nav [aria-current=page]').dataset.view}})");
            waitTrue(scenario,"window.__swipeChartSnapshot!==null");
            assertEquals("true",evaluate(scenario,"window.__swipeChartSnapshot.view==='calendar'&&window.__swipeChartSnapshot.count>0"));
        }
    }

    @Test public void themesPersistAndEmploymentChartAcceptsRealPageSwipes() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var themeNow=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),themeMonth=themeNow.slice(0,7),themeDefaults={salaryCents:600000,company:'主题验收 · 工资账本',joinDate:themeMonth.slice(0,4)+'-01-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:true};var themeRecord={...themeDefaults,leaves:[],overtime:[],subsidies:[{id:'s',date:themeMonth+'-01',amountCents:20000,category:'餐补'}],deductions:[],advances:[],payments:[{id:'p',date:themeMonth+'-01',amountCents:100000}],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:themeDefaults,months:{[themeMonth]:themeRecord},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            String expectedThemeBook=evaluate(scenario,"localStorage.getItem('dagongren.paybook.v1')");
            for(String theme:new String[]{"system","light","dark"}){
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelectorAll('.theme-option').length===3"));
                if(theme.equals("system"))paintedScreenshot(scenario,"theme-picker");
                evaluate(scenario,"document.querySelector('[data-action=choose-theme][data-theme="+theme+"]').click()");
                assertEquals("\""+theme+"\"",evaluate(scenario,"document.body.dataset.themePreference"));
            assertEquals(expectedThemeBook,evaluate(scenario,"localStorage.getItem('dagongren.paybook.v1')"));
            assertEquals("true",evaluate(scenario,"getComputedStyle(document.querySelector('.view-settings')).touchAction.includes('pan-y')"));
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.theme-gauge>svg,.theme-orbit>svg,.mix-orbit>svg')].every(e=>e.getBoundingClientRect().height>=70)"));
            evaluate(scenario,"document.querySelector('.profile-chart-panel').scrollIntoView({block:'center',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-profile");
                swipeRegion(scenario,".employment-progress",-1);
                waitTrue(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='records'&&!document.getElementById('app').classList.contains('page-transitioning')");
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
                paintedScreenshot(scenario,"theme-"+theme+"-records");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=profile-chart]').click()");
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('.record-mix-chart'))&&document.querySelectorAll('.record-type-row').length===6&&document.querySelectorAll('.profile-chart-panel').length===1"));
            evaluate(scenario,"document.querySelector('.record-mix-chart').scrollIntoView({block:'start',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-mix");
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click();document.querySelector('[data-view=home]').click();window.scrollTo({top:0,behavior:'instant'})");
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth&&Boolean(document.querySelector('.settlement-chart'))"));
                paintedScreenshot(scenario,"theme-"+theme+"-home");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();document.querySelector('[data-action=calendar-today]').click()");
            assertEquals("true",evaluate(scenario,"(()=>{const e=document.querySelector('.calendar-day.today .day-wage'),s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundImage==='none'&&s.paddingLeft==='0px'&&s.paddingRight==='0px'})()"));
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-calendar");
            evaluate(scenario,"document.querySelector('.daily-chart').scrollIntoView({block:'start',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-daily");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('#company-name').value==='主题验收 · 工资账本'&&document.documentElement.scrollWidth<=innerWidth"));
                paintedScreenshot(scenario,"theme-"+theme+"-form");
            evaluate(scenario,"document.querySelector('.modal-close').click();document.querySelector('[data-action=toggle-motion]').click()");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.profile-chart-panel *')].every(e=>getComputedStyle(e).animationName==='none')"));
            evaluate(scenario,"document.querySelector('[data-action=toggle-motion]').click()");
                expectedThemeBook=evaluate(scenario,"localStorage.getItem('dagongren.paybook.v1')");
                scenario.recreate();waitReady(scenario);
                assertEquals("\""+theme+"\"",evaluate(scenario,"document.body.dataset.themePreference"));
            assertEquals(expectedThemeBook,evaluate(scenario,"localStorage.getItem('dagongren.paybook.v1')"));
            }
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme=system]').click()");
        }
    }


    @Test public void calendarDayAmountsStayStaticAndDatesRemainAligned() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"document.querySelector('[data-action=salary-settings]').click();document.getElementById('salary').value='6000';document.querySelector('.modal-footer button[type=submit]').click();document.querySelector('[data-view=calendar]').click()");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.calendar-day .day-wage')].every(e=>e.hasAttribute('data-static-number')&&!e.classList.contains('number')&&!e.querySelector('.number-roll'))"));
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.calendar-day .number-roll-strip')&&[...document.querySelectorAll('.calendar-day[data-date]')].every(e=>Number(e.querySelector('.day-number').childNodes[0].nodeValue)===Number(e.dataset.date.slice(8)))"));
            paintedScreenshot(scenario,"calendar-rolling-settled");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=toggle-motion]').click();document.querySelector('[data-view=calendar]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.calendar-day .number-roll-strip')"));
        }
    }


    @Test public void allChartDataNumbersRollAndPreserveFinalValues() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var chartMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()),chartDefaults={salaryCents:600000,company:'图表数字动效验收',joinDate:chartMonth.slice(0,4)+'-01-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:true},chartRecord={...chartDefaults,leaves:[],overtime:[],subsidies:[{id:'s',date:chartMonth+'-01',amountCents:20000,category:'餐补'}],deductions:[],advances:[],payments:[{id:'p',date:chartMonth+'-01',amountCents:100000}],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:chartDefaults,months:{[chartMonth]:chartRecord},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            for(String theme:new String[]{"system","light","dark"}){
                evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme="+theme+"]').click()");
                for(String page:new String[]{"home","calendar","records","settings"}){
                    evaluate(scenario,"document.querySelector('[data-view="+page+"]').click();(()=>{window.__chartRoll=null;const capture=()=>window.__chartRoll=(()=>{const numbers=[...document.querySelectorAll('.data-chart [data-chart-number]')],rolling=numbers.filter(e=>e.querySelector('.number-roll-strip'));return {count:rolling.length,values:numbers.map(e=>e.getAttribute('aria-label')||e.textContent),style:rolling.every(e=>getComputedStyle(e).fontSize===getComputedStyle(e.parentElement).fontSize&&[...e.querySelectorAll('.number-roll-slot')].every(s=>getComputedStyle(s).fontSize===getComputedStyle(e).fontSize)),steps:rolling.every(e=>[...e.querySelectorAll('.number-roll-strip')].every(s=>Number(s.style.getPropertyValue('--roll-steps'))>0&&Number(s.style.getPropertyValue('--roll-steps'))<=19)),static:!document.querySelector('.chart-axis .number-roll, time .number-roll')}})();const push=document.querySelector('.page-swipe-track')?.getAnimations()[0];if(push)push.finished.then(capture);else capture()})()");
            waitTrue(scenario,"window.__chartRoll!==null");
            assertEquals("true",evaluate(scenario,"window.__chartRoll.count>0&&window.__chartRoll.style&&window.__chartRoll.steps&&window.__chartRoll.static"));
                    waitTrue(scenario,"!document.querySelector('.data-chart .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('.data-chart [data-chart-number]')].every((e,i)=>e.textContent===window.__chartRoll.values[i])"));
                }
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click();window.__mixRoll=(()=>{const n=[...document.querySelectorAll('.record-type-row strong .chart-number')];return n.length===12&&JSON.stringify(n.map(e=>e.getAttribute('aria-label')||e.textContent))===JSON.stringify(['0','0.0','0','0.0','1','50.0','0','0.0','0','0.0','1','50.0'])})()");
            assertEquals("true",evaluate(scenario,"window.__mixRoll"));
                waitTrue(scenario,"!document.querySelector('.data-chart .number-roll-strip')");
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click();document.querySelector('[data-action=toggle-motion]').click();document.querySelector('[data-view=home]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.data-chart .number-roll-strip')"));
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=toggle-motion]').click()");
            }
            evaluate(scenario,"document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme=system]').click()");
        }
    }

    @Test public void everyRecordKindKeepsAnimationsBoundedAndUnchangedRollsAlive() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),m=now.slice(0,7),d={salaryCents:600000,company:'动效回归',joinDate:m+'-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:true},r={...d,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:d,months:{[m]:r},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            for(String kind:new String[]{"leave","overtime","subsidy","deduction","advance","payment"}){
            evaluate(scenario,"document.querySelector('[data-view=home]').click();document.querySelector('[data-action=record-entry]').click();");
                evaluate(scenario,"document.querySelector('[data-action=record-kind][data-kind="+kind+"]').click()");
            evaluate(scenario,"window.__recordNav=document.querySelector('.bottom-nav');var f=document.querySelector('#modal-root form');if(f.id==='leave-form')f.elements.deductMode.value='yes';else if(f.id==='overtime-form'){f.elements.quantity.value='2';f.elements.rate.value='25';}else f.elements.amount.value='25';window.__frames=[];window.__lastFrame=performance.now();var probe=t=>{window.__frames.push(t-window.__lastFrame);window.__lastFrame=t;if(window.__frames.length<40)requestAnimationFrame(probe)};requestAnimationFrame(probe);window.__submitStart=performance.now();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));window.__submitMs=performance.now()-window.__submitStart;window.__savedRolls=[...document.querySelectorAll('.view-home .number')].map(e=>({e,text:e.getAttribute('aria-label')||e.textContent}));window.__numberAnimations=[...document.querySelectorAll('.number-roll-strip')];document.querySelector('[data-action=nav][data-view=home]').click();window.__recordAnimationCheck={formClosed:!document.querySelector('#modal-root form'),sameNav:document.querySelector('.bottom-nav')===window.__recordNav,count:window.__numberAnimations.length,kept:window.__numberAnimations.every(e=>e.isConnected),bounded:[...document.querySelectorAll('.number-roll-strip')].every(e=>e.children.length<=20&&parseFloat(e.style.animationDuration)<=440)};window.__recordAnimationCheck.ok=window.__recordAnimationCheck.formClosed&&window.__recordAnimationCheck.sameNav&&window.__recordAnimationCheck.count>0&&window.__recordAnimationCheck.kept&&window.__recordAnimationCheck.bounded");
            assertEquals(evaluate(scenario,"JSON.stringify(window.__recordAnimationCheck)"),"true",evaluate(scenario,"window.__recordAnimationCheck.ok"));
            waitTrue(scenario,"!document.querySelector('.number-roll-strip')&&window.__frames.length>=20");
            assertEquals("true",evaluate(scenario,"window.__savedRolls.every(x=>x.e.textContent===x.text)"));
                android.util.Log.i("DagongrenMotion","RECORD_"+kind+"="+evaluate(scenario,"JSON.stringify({submitMs:window.__submitMs,frames:window.__frames,rowsMax:20})"));
            }
            assertEquals("true",evaluate(scenario,"(()=>{const b=JSON.parse(localStorage.getItem('dagongren.paybook.v1')),rows=Object.values(b.months);return ['leaves','overtime','subsidies','deductions','advances','payments'].every(k=>rows.reduce((n,r)=>n+(r[k]?.length||0),0)===1)})()"));
        }
    }

    @Test public void systemAppearanceChangesPreserveDraftAndManualOverride() throws Exception {
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            assertEquals("true",evaluate(scenario,"document.body.dataset.themePreference==='system'&&document.body.dataset.theme===(AndroidFiles.systemDark()?'dark':'light')"));
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click();document.getElementById('company-name').value='切换外观保留草稿';window.__themeSentinel=true");
            device.executeShellCommand("cmd uimode night yes");
            waitTrue(scenario,"document.body.dataset.theme==='dark'&&window.__themeSentinel&&document.getElementById('company-name').value==='切换外观保留草稿'");
            paintedScreenshot(scenario,"system-dark-draft");
            evaluate(scenario,"document.querySelector('.modal-close').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme=light]').click()");
            device.executeShellCommand("cmd uimode night no");
            waitTrue(scenario,"!AndroidFiles.systemDark()&&document.body.dataset.theme==='light'");
            device.executeShellCommand("cmd uimode night yes");
            waitTrue(scenario,"AndroidFiles.systemDark()&&document.body.dataset.theme==='light'");
            evaluate(scenario,"document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme=system]').click()");
            waitTrue(scenario,"document.body.dataset.theme==='dark'");
        }finally{device.executeShellCommand("cmd uimode night no");}
    }
}
