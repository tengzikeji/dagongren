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
    private String evaluate(ActivityScenario<MainActivity> scenario,String script) throws Exception {return evaluate(scenario,script,false);}
    private String evaluateLoading(ActivityScenario<MainActivity> scenario,String script) throws Exception {return evaluate(scenario,script,true);}
    private String evaluate(ActivityScenario<MainActivity> scenario,String script,boolean observeLoading) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        if(!withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);if(web==null||(!observeLoading&&web.getProgress()<100)){result.set("null");latch.countDown();return;}web.evaluateJavascript(script,value->{result.set(value);latch.countDown();});}))return "null";
        assertTrue("WebView evaluation timed out: "+script,latch.await(25,TimeUnit.SECONDS));return result.get();
    }
    private void waitTrueLoading(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        long deadline=System.currentTimeMillis()+20000;String last="";
        while(System.currentTimeMillis()<deadline){last=evaluateLoading(scenario,script);if("true".equals(last))return;Thread.sleep(100);}
        screenshot("startup-condition-failed");
        fail("Startup condition did not become true: "+script+"; last="+last+"; "+evaluateLoading(scenario,"JSON.stringify({observed:window.__launchObserved,samples:window.__launchBlendSamples,phase:document.querySelector('.launch-page')?.dataset.phase})"));
    }
    private void waitTrue(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        long deadline=System.currentTimeMillis()+20000;String last="";
        while(System.currentTimeMillis()<deadline){
            last=evaluate(scenario,script);if("true".equals(last))return;
            Thread.sleep(150);
        }
        screenshot("condition-failed");
        String details=evaluate(scenario,"JSON.stringify({view:document.querySelector('.bottom-nav [aria-current=page]')?.dataset.view,classes:document.getElementById('app').className,modal:document.getElementById('modal-title')?.textContent,forms:[...document.querySelectorAll('#modal-root form')].map(f=>f.id),pointers:window.__pointerEvents,swipe:window.__lastSwipeTarget,viewport:[innerWidth,innerHeight,visualViewport.height],keyboard:document.body.classList.contains('keyboard-open'),focused:document.activeElement.id,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.motion,introAllowed:AndroidFiles.shouldPlayIntro(),pull:{state:document.querySelector('.pull-refresh')?.dataset.state,hidden:document.querySelector('.pull-refresh')?.hidden,cloud:document.querySelector('.cloud-sync-badge')?.dataset.state,source:document.querySelector('.cloud-sync-badge')?.dataset.source,reads:window.__reviewReads,events:window.__pullTouchEvents},rects:['.modal','.modal-body','.modal-footer','#company-name'].map(s=>{const e=document.querySelector(s);return e?{s,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}:null})})");
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
        waitTrue(scenario,"!document.querySelector('#app .data-chart .number-roll-strip,.calendar-day .number-roll-strip')");
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
            evaluate(scenario,"const defaults={salaryCents:600001,company:'����ͼ������',joinDate:'2026-09-21',periodMode:'custom',periodStartDay:21,payday:25,motion:true};const r=()=>({...defaults,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[]});const sept=r(),oct=r();sept.payments=[{id:'p',date:'2026-10-22',amountCents:200000,periodStart:'2026-09-21',periodEnd:'2026-10-20'}];sept.advances=[{id:'a',date:'2026-10-22',amountCents:100000,periodStart:'2026-09-21',periodEnd:'2026-10-20'}];oct.leaves=[{id:'l',date:'2026-10-22',days:.5,deduct:true}];oct.overtime=[{id:'o',date:'2026-10-23',mode:'custom',amountCents:8000}];oct.subsidies=[{id:'s',date:'2026-10-23',amountCents:20000,category:'�Ͳ�'}];oct.deductions=[{id:'d',date:'2026-10-24',amountCents:3000,category:'ס�޷�'}];localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults,months:{'2026-09':sept,'2026-10':oct},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            waitTrue(scenario,"Boolean(document.querySelector('#app .settlement-chart .chart-ring-fill'))");
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            waitTrue(scenario,"[...document.querySelectorAll('#app .data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-home");
            evaluate(scenario,"document.querySelector('[data-action=home-period-picker]').click();document.querySelector('[data-action=choose-home-period][data-month=\"2026-09\"]').click();document.querySelector('.month-account-head [data-metric=earned]').click()");
            assertEquals("600001",evaluate(scenario,"Number(document.querySelector('.metric-total').dataset.total)"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.metric-scope').textContent.includes('2026/09/21 �� 2026/10/20')"));
            evaluate(scenario,"document.querySelector('.modal-close').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('.month-account').dataset.start==='2026-09-21'&&!document.querySelector('.modal')"));

            evaluate(scenario,"document.querySelector('[data-view=records]').click();document.querySelector('.month-pay-card[data-period^=\"2026-09-21|\"]').click();document.querySelector('.period-component-list .sum').click()");
            assertEquals("600001",evaluate(scenario,"Number(document.querySelector('.metric-total').dataset.total)"));
            evaluate(scenario,"globalThis.dagongrenBack();document.querySelector('[data-view=records]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('.annual-chart .wage-plot'))");
            waitTrue(scenario,"[...document.querySelectorAll('#app .data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-records");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click()");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&Boolean(document.querySelector('#app .employment-chart'))&&!document.querySelector('#app .record-mix-chart')");
            waitTrue(scenario,"!document.querySelector('#app .employment-chart .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"document.querySelectorAll('#app .employment-metrics [data-stat]').length===3"));
            assertEquals("true",evaluate(scenario,"(()=>{const e=document.querySelector('#app .employment-chart'),days=Math.round((Date.parse(e.dataset.asOf)-Date.parse('2026-09-21'))/86400000)+1;return parseInt(e.querySelector('[data-stat=days]').textContent)===days})()"));
            waitTrue(scenario,"[...document.querySelectorAll('#app .data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
            paintedScreenshot(scenario,"charts-profile");
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click()");
            waitTrue(scenario,"document.querySelectorAll('#app .record-mix-bar .mix-segment').length===6&&!document.querySelector('#app .employment-chart')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('#app .mix-segment')].reduce((n,e)=>n+Number(e.dataset.count),0)===6&&document.querySelectorAll('#app .profile-chart-panel').length===1"));
            evaluate(scenario,"document.querySelector('#app .record-mix-chart').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"charts-profile-records");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            selectCalendarMonth(scenario,"2021-02");
            assertEquals("28",evaluate(scenario,"document.querySelector('#app .calendar-days').children.length"));
            evaluate(scenario,"window.__fourWeekHeight=document.querySelector('#app .calendar-days').getBoundingClientRect().height;document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-four-weeks");
            selectCalendarMonth(scenario,"2024-02");
            assertEquals("35",evaluate(scenario,"document.querySelector('#app .calendar-days').children.length"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-five-weeks");
            selectCalendarMonth(scenario,"2026-08");
            assertEquals("42",evaluate(scenario,"document.querySelector('#app .calendar-days').children.length"));
            assertEquals("true",evaluate(scenario,"document.querySelector('#app .calendar-days').getBoundingClientRect().height>window.__fourWeekHeight*1.4"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-six-weeks");
            selectCalendarMonth(scenario,"2026-10");
            waitTrue(scenario,"document.querySelectorAll('#app .daily-chart .chart-bar').length>0");
            waitTrue(scenario,"!document.querySelector('#app .calendar-summary .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('#app .daily-chart .chart-bar')].reduce((n,e)=>n+Number(e.dataset.amount),0)===Math.round(Number(document.querySelector('#app .calendar-summary button strong').textContent.replace(/[^0-9.-]/g,''))*100)"));
            evaluate(scenario,"document.querySelector('#app .daily-chart').scrollIntoView({block:'start'})");
            waitTrue(scenario,"[...document.querySelectorAll('#app .data-chart *')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished')");
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
                evaluate(scenario,"document.querySelector('[data-view="+main+"]').click();document.querySelector('[data-action=record-entry]').click();document.querySelector('[data-kind=subsidy]').click();document.getElementById('adjustment-note').value='�����ϲ�ݸ�';document.querySelector('.select-trigger').click()");
                waitTrue(scenario,"Boolean(document.querySelector('.choice-sheet'))");
                pressAppBack(scenario);
                waitTrue(scenario,"!document.querySelector('.choice-sheet')&&Boolean(document.getElementById('subsidy-form'))");
                assertEquals("\"�����ϲ�ݸ�\"",evaluate(scenario,"document.getElementById('adjustment-note').value"));
                evaluate(scenario,"document.querySelector('.modal-back').click()");
                waitTrue(scenario,"document.getElementById('modal-title').textContent==='��һ��'");
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
            assertEquals("\"ȷ������\"",evaluate(scenario,"document.querySelector('[data-action=confirm-cleanup]').textContent"));
            pressAppBack(scenario);waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.cleanup-panel'))");
            evaluate(scenario,"document.querySelector('[data-action=review-cleanup]').click();document.querySelector('.modal-close').click()");
            waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.profile-card'))");
            paintedScreenshot(scenario,"menus-return-profile");
        }
    }

    @Test public void signedCalendarAmountsAndUsageStayAccurate() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var signedDefaults={salaryCents:310000,company:'������ɫ����',joinDate:'2026-10-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:false};var signedRecord={...signedDefaults,leaves:[{id:'zero',date:'2026-10-03',days:1,deduct:true}],overtime:[],subsidies:[],deductions:[{id:'negative',date:'2026-10-02',amountCents:30000,category:'ס�޷�'}],advances:[],payments:[],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:signedDefaults,months:{'2026-10':signedRecord},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            selectCalendarMonth(scenario,"2026-10");
            assertEquals("true",evaluate(scenario,"(()=>{const cell=date=>document.querySelector('#app .calendar-day[data-date=\"'+date+'\"] .day-wage'),rgb=e=>getComputedStyle(e).color.match(/[0-9.]+/g).map(Number),p=cell('2026-10-01'),n=cell('2026-10-02'),z=cell('2026-10-03'),f=cell('2026-10-31'),pc=rgb(p),nc=rgb(n);return Number(p.textContent)===100&&Number(n.textContent)===-200&&Number(z.textContent)===0&&f.textContent==='��'&&pc[1]>pc[0]&&pc[1]>pc[2]&&nc[0]>nc[1]&&nc[0]>nc[2]&&getComputedStyle(z).color===getComputedStyle(f).color&&z.classList.contains('wage-neutral')})()"));
            assertEquals("true",evaluate(scenario,"(()=>{const today=document.querySelector('#app .calendar-day.today .day-wage');const c=getComputedStyle(today).color.match(/[0-9.]+/g).map(Number);return c[1]>c[0]&&c[1]>c[2]})()"));
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start'})");
            paintedScreenshot(scenario,"calendar-signed-wages");
            evaluate(scenario,"document.querySelector('[data-action=calendar-sources]').click()");
            assertEquals("true",evaluate(scenario,"(()=>{const t=document.querySelector('.modal-body').textContent;return t.includes('���ǵ���ʵ���յ��Ĺ���')&&t.includes('4��5��6��')&&t.includes('������������')&&t.includes('δ�����ڲ���ǰ��н')&&t.includes('�޸�Ĭ�Ͽ��ز���Ķ��ɼ�¼')})()"));
            paintedScreenshot(scenario,"calendar-usage");
            evaluate(scenario,"document.querySelector('[data-action=calendar-rights]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('.modal-body').textContent.includes('�����԰�')&&!document.querySelector('[name=accterm]')"));
            evaluate(scenario,"document.querySelector('.modal-back').click()");
            assertEquals("\"����ʹ��˵��\"",evaluate(scenario,"document.getElementById('modal-title').textContent"));
            evaluate(scenario,"document.querySelector('.modal-close').click()");
            waitTrue(scenario,"!document.querySelector('.modal')&&Boolean(document.querySelector('.calendar-panel'))");
        }
    }

    private String rollingLayoutCheck(String selector) {
        return "(()=>{const numbers=[...document.querySelectorAll('"+selector+"')];return numbers.length===2&&numbers.some(n=>n.querySelectorAll('.number-roll-slot').length>1)&&numbers.every(n=>{const slots=[...n.querySelectorAll('.number-roll-slot')];return slots.length>0&&slots.every(s=>getComputedStyle(s).display==='inline-block'&&getComputedStyle(s).fontSize===getComputedStyle(n).fontSize&&Math.abs(s.getBoundingClientRect().top-slots[0].getBoundingClientRect().top)<1)})})()";
    }
    @Test public void appLoadsSavesWagesAndOffersEditableConnection() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            withActivity(activity->{assertEquals("����",activity.getString(R.string.app_name));assertEquals(0,activity.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE);});
            resetBook(scenario);
            assertEquals("4",evaluate(scenario,"document.querySelectorAll('.bottom-nav button').length"));
            assertEquals("0",evaluate(scenario,"JSON.parse(localStorage.getItem('dagongren.paybook.v1')).defaults.salaryCents"));
            assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('#app .view-home [data-action=home-current]'))&&!document.querySelector('#app .view-home [data-action=salary-settings]')"));
            evaluate(scenario,"document.querySelector('.bottom-nav [data-view=settings]').click();document.querySelector('#app .view-settings [data-action=salary-settings]').click()");
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
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"���ҵ�\"]'))"));
            assertEquals("true",evaluate(scenario,"document.querySelector('.bottom-nav').getBoundingClientRect().height<=66"));
            paintedScreenshot(scenario,"home");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click()");
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click()");
            evaluate(scenario,"document.querySelector('[data-action=calendar-today]').click()");
            waitTrue(scenario,"Boolean(document.querySelector('[aria-current=date]'))");
            assertEquals("true",evaluate(scenario,"document.querySelector('[aria-current=date]').dataset.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())"));
            paintedScreenshot(scenario,"calendar-today");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click()");
            evaluate(scenario,"document.getElementById('company-name').value='ʾ���Ƽ����޹�˾�����ݵ�����Ӫ��������';document.querySelector('.modal-footer button[type=submit]').click()");
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
                assertEquals("true",evaluate(scenario,"document.getElementById('cleanup-include-cloud').checked&&document.querySelector('.cleanup-page-title h2').textContent==='�����������ƶ�'"));
                paintedScreenshot(scenario,"cleanup-cloud-option");
                evaluate(scenario,"document.getElementById('cleanup-include-cloud').click()");
                assertEquals("false",evaluate(scenario,"document.getElementById('cleanup-include-cloud').checked"));
                assertEquals("true",evaluate(scenario,"document.querySelector('[data-action=export]').textContent.trim()==='�����˱�'"));
            }
        } finally { vault.clear(); }
    }

    @Test public void cleanupRebuildAndCardPickerPreserveDraft() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=salary-settings]').click();document.getElementById('salary').value='6000';document.querySelector('.modal-footer button[type=submit]').click()");
            evaluate(scenario,"document.querySelector('[data-action=company-settings]').click();document.getElementById('company-name').value='�������Թ�˾';const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-2);document.getElementById('join-date').value=d.toISOString().slice(0,10);document.querySelector('.modal-footer button[type=submit]').click()");
            assertEquals("3",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-action=open-cleanup]').click();document.querySelector('[data-action=cleanup-scope][data-scope=year]').click();document.querySelector('[data-action=cleanup-scope][data-scope=all]').click()");
            assertEquals("3",evaluate(scenario,"document.querySelectorAll('.cleanup-scope-card').length"));
            assertEquals("true",evaluate(scenario,"!document.getElementById('cleanup-include-cloud').checked&&document.getElementById('cleanup-include-cloud').disabled"));
            paintedScreenshot(scenario,"cleanup-range-cards");
            evaluate(scenario,"document.querySelector('[data-action=review-cleanup]').click();document.querySelector('[data-action=confirm-cleanup]').click()");
            assertEquals("0",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click();document.querySelector('.modal-footer button[type=submit]').click()");
            assertEquals("3",evaluate(scenario,"Object.keys(JSON.parse(localStorage.getItem('dagongren.paybook.v1')).months).length"));
            evaluate(scenario,"document.querySelector('[data-action=record-entry]').click();document.querySelector('[data-kind=payment]').click();const a=document.getElementById('cash-amount');a.value='123.45';a.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('cash-note').value='������д����';document.querySelector('.select-trigger').click()");
            waitTrue(scenario,"Boolean(document.querySelector('.choice-sheet .choice-card'))");
            paintedScreenshot(scenario,"payment-period-cards");
            evaluate(scenario,"document.querySelector('.choice-card:not(.selected)').click()");
            assertEquals("\"123.45\"",evaluate(scenario,"document.getElementById('cash-amount').value"));
            assertEquals("\"������д����\"",evaluate(scenario,"document.getElementById('cash-note').value"));
            evaluate(scenario,"document.querySelector('.select-trigger').click()");
            assertEquals("true",evaluate(scenario,"globalThis.dagongrenBack()"));
            assertEquals("true",evaluate(scenario,"Boolean(document.getElementById('payment-form'))"));
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('.choice-sheet'))"));
            evaluate(scenario,"globalThis.dagongrenBack();globalThis.dagongrenBack();document.querySelector('[data-view=calendar]').click()");
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"���ҵ�\"]'))"));
            evaluate(scenario,"document.querySelector('[data-view=records]').click()");
            assertEquals("false",evaluate(scenario,"Boolean(document.querySelector('[aria-label=\"���ҵ�\"]'))"));
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
        // Leave the instrumentation activity before recording a real launch from Home.
        device.pressHome();device.waitForIdle(2000);dismissEmulatorLauncherAnr();
        device.executeShellCommand("mkdir -p /sdcard/Download/dagongren-test");
        Thread recording=new Thread(()->{try{device.executeShellCommand("screenrecord --size 720x1280 --bit-rate 2000000 --time-limit 30 /sdcard/Download/dagongren-test/startup-transition.mp4");}catch(Exception ignored){}},"startup-recording");recording.setDaemon(true);recording.start();
        // Wait for the recorder to capture the launcher before starting the app.
        long readyDeadline=System.currentTimeMillis()+10000;String recordingPid="";
        while(recording.isAlive()&&System.currentTimeMillis()<readyDeadline){recordingPid=device.executeShellCommand("pidof screenrecord").trim();if(!recordingPid.isEmpty())break;Thread.sleep(100);}
        assertFalse("Startup screen recording did not start",recordingPid.isEmpty());
        long recordingStarted=System.currentTimeMillis();Thread.sleep(1500);
        ActivityScenario<MainActivity> scenario=null;
        android.content.Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        target.startActivity(new android.content.Intent(target,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK));
        try{
            waitTrueLoading(scenario,"(()=>{const entry=performance.getEntriesByName('dagongren.launch.playing').at(-1);if(!entry)return false;window.__launchObserved=entry.detail;if(!window.__launchFrameWatching){window.__launchFrameWatching=true;window.__launchBlendSamples=[];const sample=()=>{const page=document.querySelector('.launch-page');if(!page)return;if(page.dataset.phase==='fading'){const rect=page.getBoundingClientRect(),style=getComputedStyle(page);window.__launchBlendSamples.push({opacity:Number(style.opacity),homeOpacity:Number(getComputedStyle(document.getElementById('app')).opacity),width:rect.width,height:rect.height,left:rect.left,top:rect.top,transform:style.transform,radius:style.borderRadius})}requestAnimationFrame(sample)};requestAnimationFrame(sample)}return true})()");
            assertEquals("1",evaluateLoading(scenario,"window.__launchObserved.surfaces"));
            assertTrue(withActivity(activity->{assertTrue(activity.isFirstLaunchFramePresented());assertFalse(activity.hasBitmapLaunchCover());assertTrue(activity.getWindow().getDecorView().isHardwareAccelerated());assertNull(activity.getWindow().getDecorView().findViewWithTag("dagongren-native-launch"));}));
            assertEquals(evaluateLoading(scenario,"JSON.stringify(window.__launchObserved)"),"true",evaluateLoading(scenario,"!window.__launchObserved.nativeFade&&window.__launchObserved.animationVersion==='1.3.4'&&!window.__launchObserved.prelude&&window.__launchObserved.appReadyAtStart===false&&window.__launchObserved.liveScene&&!window.__launchObserved.bitmapSurface"));
            assertEquals("false",evaluateLoading(scenario,"window.__launchObserved.oldBrand"));
            assertEquals("true",evaluateLoading(scenario,"window.__launchObserved.inert"));
            assertEquals("true",evaluateLoading(scenario,"window.__launchObserved.animated&&['launch-soft-in','launch-line','launch-bar','launch-sheen','launch-orbit','launch-dot'].every(name=>window.__launchObserved.animationNames.includes(name))"));
            waitTrueLoading(scenario,"performance.getEntriesByName('dagongren.app.render').length>0");
            assertEquals("true",evaluateLoading(scenario,"(()=>{const created=performance.getEntriesByName('dagongren.launch.created')[0],painted=performance.getEntriesByName('dagongren.launch.painted')[0],render=performance.getEntriesByName('dagongren.app.render')[0],playing=performance.getEntriesByName('dagongren.launch.playing')[0];return !!created&&!!painted&&!!render&&created.startTime<=painted.startTime&&painted.startTime<=playing.startTime&&playing.startTime<render.startTime})()"));
            double playingSecond=(Double.parseDouble(evaluateLoading(scenario,"window.__launchObserved.at"))-recordingStarted)/1000.0;
            android.util.Log.i("DagongrenLaunchReview","PLAYING_SECOND="+playingSecond);
            waitTrueLoading(scenario,"window.__launchBlendSamples.some(frame=>frame.opacity>0&&frame.opacity<1&&frame.homeOpacity===1&&Math.abs(frame.width-innerWidth)<1&&Math.abs(frame.height-innerHeight)<1)");
            waitTrueLoading(scenario,"!document.querySelector('.launch-page')");
            double fadingSecond=(Double.parseDouble(evaluateLoading(scenario,"performance.timeOrigin+performance.getEntriesByName('dagongren.launch.fading').at(-1).startTime"))-recordingStarted)/1000.0;
            android.util.Log.i("DagongrenLaunchReview","FADING_SECOND="+fadingSecond);
            String blendReview=evaluateLoading(scenario,"JSON.stringify({detail:performance.getEntriesByName('dagongren.launch.fading').at(-1)?.detail,viewport:[innerWidth,innerHeight],sampleCount:window.__launchBlendSamples.length,samples:window.__launchBlendSamples.slice(0,12)})");
            android.util.Log.i("DagongrenLaunchReview","BLEND_REVIEW="+blendReview);
            assertEquals("true",evaluateLoading(scenario,"(()=>{const d=performance.getEntriesByName('dagongren.launch.fading').at(-1)?.detail,s=window.__launchBlendSamples;return !!d&&d.duration===640&&d.hold===1700&&d.surfaces===1&&d.fullScreen&&d.homeReady&&s.length>=3&&s.every((f,i)=>f.homeOpacity===1&&Math.abs(f.width-innerWidth)<1&&Math.abs(f.height-innerHeight)<1&&f.left===0&&f.top===0&&f.transform==='none'&&f.radius==='0px'&&(!i||f.opacity<=s[i-1].opacity+.001))})()"));
            assertEquals("false",evaluateLoading(scenario,"document.getElementById('app').inert"));
            assertEquals("\"none\"",evaluateLoading(scenario,"getComputedStyle(document.getElementById('view-content')).animationName"));
            assertEquals("true",evaluateLoading(scenario,"Boolean(document.querySelector('.bottom-nav'))"));
            assertEquals("true",evaluateLoading(scenario,"performance.getEntriesByName('dagongren.home.glare').length===0&&!document.querySelector('.hero-startup-glare')"));
            evaluateLoading(scenario,"window.__selfCheckBook=localStorage.getItem('dagongren.paybook.v1')");
            device.pressHome();
            target.startActivity(new android.content.Intent(target,MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK|android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
            waitTrueLoading(scenario,"Boolean(document.querySelector('#app .view-home'))&&!document.querySelector('.launch-page')&&!document.getElementById('app').inert");
            awaitInputWindow(scenario);dismissEmulatorLauncherAnr();
            assertEquals("true",evaluateLoading(scenario,"performance.getEntriesByName('dagongren.home.self-check').length===0&&performance.getEntriesByName('dagongren.home.glare').length===0&&performance.getEntriesByName('dagongren.home.glare.complete').length===0&&localStorage.getItem('dagongren.paybook.v1')===window.__selfCheckBook"));
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
                CountDownLatch frame=new CountDownLatc…11897 tokens truncated…(document.querySelector('#app .settlement-chart'))"));
                paintedScreenshot(scenario,"theme-"+theme+"-home");
            evaluate(scenario,"document.querySelector('[data-view=calendar]').click();document.querySelector('[data-action=calendar-today]').click()");
            assertEquals("true",evaluate(scenario,"(()=>{const e=document.querySelector('#app .calendar-day.today .day-wage'),s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundImage==='none'&&s.paddingLeft==='0px'&&s.paddingRight==='0px'})()"));
            assertEquals("true",evaluate(scenario,"document.documentElement.scrollWidth<=innerWidth"));
            evaluate(scenario,"document.querySelector('.calendar-panel').scrollIntoView({block:'start',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-calendar");
            evaluate(scenario,"document.querySelector('#app .daily-chart').scrollIntoView({block:'start',behavior:'instant'})");
                paintedScreenshot(scenario,"theme-"+theme+"-daily");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click()");
            assertEquals("true",evaluate(scenario,"document.querySelector('#company-name').value==='�������� �� �����˱�'&&document.documentElement.scrollWidth<=innerWidth"));
                paintedScreenshot(scenario,"theme-"+theme+"-form");
            evaluate(scenario,"document.querySelector('.modal-close').click();document.querySelector('[data-action=toggle-motion]').click()");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('#app .profile-chart-panel *')].every(e=>getComputedStyle(e).animationName==='none')"));
            assertTrue(withActivity(activity->assertFalse(activity.isNativeMotionEnabled())));
            evaluate(scenario,"document.querySelector('[data-action=toggle-motion]').click()");
            assertTrue(withActivity(activity->assertTrue(activity.isNativeMotionEnabled())));
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
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('#app .calendar-day .day-wage')].every(e=>e.hasAttribute('data-static-number')&&!e.classList.contains('number')&&!e.querySelector('.number-roll'))"));
            evaluate(scenario,"document.querySelector('[data-action=shift-month][data-delta=\"-1\"]').click();document.querySelector('[data-action=shift-month][data-delta=\"1\"]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('#app .calendar-day .number-roll-strip')&&[...document.querySelectorAll('#app .calendar-day[data-date]')].every(e=>Number(e.querySelector('.day-number').childNodes[0].nodeValue)===Number(e.dataset.date.slice(8)))"));
            paintedScreenshot(scenario,"calendar-rolling-settled");
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=toggle-motion]').click();document.querySelector('[data-view=calendar]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('#app .calendar-day .number-roll-strip')"));
        }
    }


    @Test public void allChartDataNumbersRollAndPreserveFinalValues() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var chartMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()),chartDefaults={salaryCents:600000,company:'ͼ�����ֶ�Ч����',joinDate:chartMonth.slice(0,4)+'-01-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:true},chartRecord={...chartDefaults,leaves:[],overtime:[],subsidies:[{id:'s',date:chartMonth+'-01',amountCents:20000,category:'�Ͳ�'}],deductions:[],advances:[],payments:[{id:'p',date:chartMonth+'-01',amountCents:100000}],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:chartDefaults,months:{[chartMonth]:chartRecord},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            for(String theme:new String[]{"system","light","dark"}){
                evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme="+theme+"]').click()");
                for(String page:new String[]{"home","calendar","records","settings"}){
                    evaluate(scenario,"document.querySelector('[data-view="+page+"]').click();(()=>{window.__chartRoll=null;const capture=()=>window.__chartRoll=(()=>{const numbers=[...document.querySelectorAll('#app .data-chart [data-chart-number]')],rolling=numbers.filter(e=>e.querySelector('.number-roll-strip'));return {count:rolling.length,values:numbers.map(e=>e.getAttribute('aria-label')||e.textContent),style:rolling.every(e=>getComputedStyle(e).fontSize===getComputedStyle(e.parentElement).fontSize&&[...e.querySelectorAll('.number-roll-slot')].every(s=>getComputedStyle(s).fontSize===getComputedStyle(e).fontSize)),steps:rolling.every(e=>[...e.querySelectorAll('.number-roll-strip')].every(s=>Number(s.style.getPropertyValue('--roll-steps'))>0&&Number(s.style.getPropertyValue('--roll-steps'))<=19)),static:!document.querySelector('#app .chart-axis .number-roll, time .number-roll')}})();const push=document.querySelector('.page-swipe-track')?.getAnimations()[0];if(push)push.finished.then(capture);else capture()})()");
            waitTrue(scenario,"window.__chartRoll!==null");
            assertEquals("true",evaluate(scenario,"window.__chartRoll.count>0&&window.__chartRoll.style&&window.__chartRoll.steps&&window.__chartRoll.static"));
                    waitTrue(scenario,"!document.querySelector('#app .data-chart .number-roll-strip')");
            assertEquals("true",evaluate(scenario,"[...document.querySelectorAll('#app .data-chart [data-chart-number]')].every((e,i)=>e.textContent===window.__chartRoll.values[i])"));
                }
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click();window.__mixRoll=(()=>{const n=[...document.querySelectorAll('#app .record-type-row strong .chart-number')];return n.length===12&&JSON.stringify(n.map(e=>e.getAttribute('aria-label')||e.textContent))===JSON.stringify(['0','0.0','0','0.0','1','50.0','0','0.0','0','0.0','1','50.0'])})()");
            assertEquals("true",evaluate(scenario,"window.__mixRoll"));
                waitTrue(scenario,"!document.querySelector('#app .data-chart .number-roll-strip')");
            evaluate(scenario,"document.querySelector('[data-action=profile-chart]').click();document.querySelector('[data-action=toggle-motion]').click();document.querySelector('[data-view=home]').click()");
            assertEquals("true",evaluate(scenario,"!document.querySelector('#app .data-chart .number-roll-strip')"));
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=toggle-motion]').click()");
            }
            evaluate(scenario,"document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme=system]').click()");
        }
    }

    @Test public void everyRecordKindKeepsAnimationsBoundedAndUnchangedRollsAlive() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"var now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),m=now.slice(0,7),d={salaryCents:600000,company:'��Ч�ع�',joinDate:m+'-01',periodMode:'calendar',periodStartDay:1,payday:15,motion:true},r={...d,leaves:[],overtime:[],subsidies:[],deductions:[],advances:[],payments:[],payment:null};localStorage.setItem('dagongren.paybook.v1',JSON.stringify({version:2,defaults:d,months:{[m]:r},excludedMonths:[],sync:{auto:false,nativeVersion:1,pending:0,logs:[]}}))");
            scenario.recreate();waitReady(scenario);
            for(String kind:new String[]{"leave","overtime","subsidy","deduction","advance","payment"}){
            evaluate(scenario,"document.querySelector('[data-view=home]').click();document.querySelector('[data-action=record-entry]').click();");
                evaluate(scenario,"document.querySelector('[data-action=record-kind][data-kind="+kind+"]').click()");
            evaluate(scenario,"window.__recordNav=document.querySelector('.bottom-nav');var f=document.querySelector('#modal-root form');if(f.id==='leave-form')f.elements.deductMode.value='yes';else if(f.id==='overtime-form'){f.elements.quantity.value='2';f.elements.rate.value='25';}else f.elements.amount.value='25';window.__frames=[];window.__lastFrame=performance.now();var probe=t=>{window.__frames.push(t-window.__lastFrame);window.__lastFrame=t;if(window.__frames.length<40)requestAnimationFrame(probe)};requestAnimationFrame(probe);window.__submitStart=performance.now();f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));window.__submitMs=performance.now()-window.__submitStart;window.__savedRolls=[...document.querySelectorAll('#app .view-home .number')].map(e=>({e,text:e.getAttribute('aria-label')||e.textContent}));window.__numberAnimations=[...document.querySelectorAll('#app .number-roll-strip')];document.querySelector('[data-action=nav][data-view=home]').click();window.__recordAnimationCheck={formClosed:!document.querySelector('#modal-root form'),sameNav:document.querySelector('.bottom-nav')===window.__recordNav,count:window.__numberAnimations.length,kept:window.__numberAnimations.every(e=>e.isConnected),bounded:[...document.querySelectorAll('#app .number-roll-strip')].every(e=>e.children.length<=20&&parseFloat(e.style.animationDuration)<=440)};window.__recordAnimationCheck.ok=window.__recordAnimationCheck.formClosed&&window.__recordAnimationCheck.sameNav&&window.__recordAnimationCheck.count>0&&window.__recordAnimationCheck.kept&&window.__recordAnimationCheck.bounded");
            assertEquals(evaluate(scenario,"JSON.stringify(window.__recordAnimationCheck)"),"true",evaluate(scenario,"window.__recordAnimationCheck.ok"));
            waitTrue(scenario,"!document.querySelector('#app .number-roll-strip')&&window.__frames.length>=20");
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
            evaluate(scenario,"document.querySelector('[data-view=settings]').click();document.querySelector('[data-action=company-settings]').click();document.getElementById('company-name').value='�л���۱����ݸ�';window.__themeSentinel=true");
            device.executeShellCommand("cmd uimode night yes");
            waitTrue(scenario,"document.body.dataset.theme==='dark'&&window.__themeSentinel&&document.getElementById('company-name').value==='�л���۱����ݸ�'");
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
    @Test public void thumbSwipesStartEarlyAndCommitWithLessTravel() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true");
            waitTrue(scenario,"Boolean(document.querySelector('.page-swipe-preload'))");
            evaluate(scenario,"window.__dragInput('pointerdown',300,100,0,'.topbar')");
            assertEquals("true",evaluate(scenario,"(()=>{const layer=document.querySelector('.page-swipe-preload');return !!layer&&Number(getComputedStyle(layer).opacity)<.01&&getComputedStyle(document.querySelector('.workspace .content')).visibility==='visible'})()"));
            evaluate(scenario,"window.__dragInput('pointermove',296,100,10)");
            nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"(()=>{const layer=document.querySelector('.page-swipe-layer'),track=layer?.querySelector('.page-swipe-track'),mark=performance.getEntriesByName('dagongren.page.activate').at(-1);return !!track&&getComputedStyle(layer).opacity==='1'&&track.children.length===2&&Math.abs(new DOMMatrix(getComputedStyle(track).transform).m41+4)<.6&&mark?.detail?.prepared===true})()"));
            nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.page-swipe-track')).transform).m41+4)<.6"));
            evaluate(scenario,"window.__dragInput('pointermove',280,100,35);window.__dragInput('pointerup',280,100,40)");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='calendar'");
            waitTrue(scenario,"Boolean(document.querySelector('.calendar-swipe-preload'))");
            evaluate(scenario,"window.__thumbMonth=document.querySelector('[data-calendar-month]').dataset.calendarMonth;window.__dragInput('pointerdown',280,300,100,'.calendar-days')");
            assertEquals("true",evaluate(scenario,"(()=>{const track=document.querySelector('.calendar-swipe-preload'),grid=document.querySelector('.calendar-grid-viewport>.calendar-days');return !!track&&Number(getComputedStyle(track).opacity)<.01&&getComputedStyle(grid).visibility==='visible'})()"));
            evaluate(scenario,"window.__dragInput('pointermove',276,300,110)");
            nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"(()=>{const track=document.querySelector('.calendar-swipe-track'),mark=performance.getEntriesByName('dagongren.calendar.activate').at(-1);return !!track&&getComputedStyle(track).opacity==='1'&&track.children.length===2&&Math.abs(new DOMMatrix(getComputedStyle(track).transform).m41+4)<.6&&mark?.detail?.prepared===true})()"));
            nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"!document.querySelector('.page-swipe-layer')&&Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.calendar-swipe-track')).transform).m41+4)<.6"));
            evaluate(scenario,"window.__dragInput('pointermove',260,300,135);window.__dragInput('pointerup',260,300,140)");
            waitTrue(scenario,"!document.querySelector('.calendar-swipe-track')&&document.querySelector('[data-calendar-month]').dataset.calendarMonth!==window.__thumbMonth");
            evaluate(scenario,"window.__dragInput('pointerdown',innerWidth*.7,100,1000,'.topbar');window.__dragInput('pointermove',innerWidth*.49,100,2000);window.__dragInput('pointerup',innerWidth*.49,100,2500)");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='records'");
        }
    }
    @Test public void calendarPaintsStayStableAndNonDateRegionsNavigatePages() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            evaluate(scenario,"window.__dragInput=(name,x,y,t,selector)=>{if(name==='pointerdown')window.__dragNode=document.querySelector(selector);const e=new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:771,isPrimary:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'timeStamp',{value:t});window.__dragNode.dispatchEvent(e);};window.__nextFrames=()=>{window.__framesReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__framesReady=true));};true");
            evaluate(scenario,"window.__datePaint=s=>[...document.querySelector(s).querySelectorAll('[data-date]')].map(n=>{const s=getComputedStyle(n);return [n.dataset.date,s.color,s.backgroundColor,s.borderColor,...[...n.querySelectorAll('.day-number,.lunar-label,.day-wage,.day-badge')].map(x=>getComputedStyle(x).color)]})");
            for(String theme:new String[]{"light","dark"}){
                evaluate(scenario,"document.querySelector('.bottom-nav [data-view=settings]').click();document.querySelector('[data-action=theme-settings]').click();document.querySelector('[data-action=choose-theme][data-theme="+theme+"]').click();document.querySelector('.bottom-nav [data-view=calendar]').click()");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
                selectCalendarMonth(scenario,"2026-10");
            evaluate(scenario,"window.__paintBefore=JSON.stringify(window.__datePaint('.calendar-days'));window.__dateWidth=document.querySelector('.calendar-grid-viewport').clientWidth;window.__dragInput('pointerdown',280,300,3000,'.calendar-days [data-date]');window.__dragInput('pointermove',280-window.__dateWidth*.45,300,4000)");
                nextGestureFrames(scenario);
            assertEquals("true",evaluate(scenario,"JSON.stringify(window.__datePaint('.calendar-leaving .calendar-days'))===window.__paintBefore"));
            evaluate(scenario,"window.__paintNext=JSON.stringify(window.__datePaint('.calendar-entering .calendar-days'));window.__dragInput('pointerup',280-window.__dateWidth*.45,300,4500)");
            waitTrue(scenario,"!document.querySelector('.calendar-swipe-track')");
            assertEquals("true",evaluate(scenario,"JSON.stringify(window.__datePaint('.calendar-days'))===window.__paintNext&&document.querySelector('[data-calendar-month]').dataset.calendarMonth==='2026-11'"));
            evaluate(scenario,"window.__dragInput('pointerdown',280,250,5000,'.calendar-week');window.__dragInput('pointermove',80,250,6000);window.__dragInput('pointerup',80,250,6500)");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='records'");
            evaluate(scenario,"document.querySelector('.bottom-nav [data-view=calendar]').click()");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')");
            evaluate(scenario,"window.__dragInput('pointerdown',80,250,7000,'.month-control');window.__dragInput('pointermove',280,250,8000);window.__dragInput('pointerup',280,250,8500)");
            waitTrue(scenario,"!document.querySelector('.page-swipe-layer')&&document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='home'");
            }
        }
    }

    private void installSyncReviewFixture(ActivityScenario<MainActivity> scenario) throws Exception {
        final String injection="""
            (()=>{const real=window.AndroidFiles,book=JSON.parse(localStorage.getItem('dagongren.paybook.v1'));
            book.defaults.motion=false;book.sync={...book.sync,auto:false,nativeVersion:1};delete book.sync.baseBook;delete book.sync.baseline;
            localStorage.setItem('dagongren.paybook.v1',JSON.stringify(book));window.__reviewBook=JSON.parse(JSON.stringify(book));window.__reviewReads=0;window.__reviewWrites=0;window.__reviewVersion=1;window.__reviewFailure=false;window.__reviewDelay=900;window.__reviewHoldReads=false;window.__reviewHeld=[];window.__releaseReviewReads=()=>{window.__reviewHoldReads=false;for(const reply of window.__reviewHeld.splice(0))reply();};
            window.AndroidFiles={shouldPlayIntro:()=>false,nativeLaunchPage:()=>false,introReady:()=>real.introReady(),introStyle:v=>real.introStyle(v),motionStyle:v=>real.motionStyle(v),systemDark:()=>real.systemDark(),themeStyle:v=>real.themeStyle(v),fingerprint:v=>real.fingerprint(v),status:()=>JSON.stringify({configured:true,username:'sync-review@example.invalid',path:'����/�����˱�.json'}),request(id,action,payload){
            if(action==='calendar-read'){setTimeout(()=>globalThis.dagongrenNativeResult(id,{ok:false,error:'���Բ������ⲿ����'}),0);return;}
            if(action==='read'){window.__reviewReads++;const reply=()=>globalThis.dagongrenNativeResult(id,window.__reviewFailure?{ok:false,error:'���������жϣ�������¼����'}:{ok:true,data:{exists:true,etag:'"'+window.__reviewVersion+'"',envelope:{format:'dagongren.webdav.v2',book:JSON.parse(JSON.stringify(window.__reviewBook))}}});if(window.__reviewHoldReads)window.__reviewHeld.push(reply);else setTimeout(reply,window.__reviewDelay);return;}
            if(action==='write'){window.__reviewWrites++;const data=JSON.parse(payload);window.__reviewBook=JSON.parse(data.content);window.__reviewVersion++;setTimeout(()=>globalThis.dagongrenNativeResult(id,{ok:true,data:{saved:true}}),20);return;}
            setTimeout(()=>globalThis.dagongrenNativeResult(id,{ok:false,error:'��֧�ֵĲ��Բ���'}),0);
            }};})()
            """;
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
            });web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html?review=refresh");
        }catch(Exception error){throw new RuntimeException(error);}});
        waitReady(scenario);waitTrue(scenario,"document.body.classList.contains('motion-off')&&window.__reviewReads===0");
    }
    private void nativePull(ActivityScenario<MainActivity> scenario) throws Exception {
        evaluate(scenario,"window.scrollTo({top:0,behavior:'instant'});window.__pullTouchEvents=[];if(!window.__pullTouchTracking){window.__pullTouchTracking=true;for(const type of ['touchstart','touchmove','touchend','touchcancel','pointercancel'])document.addEventListener(type,e=>{if(window.__pullTouchEvents.length<60)window.__pullTouchEvents.push({type:e.type,cancelable:e.cancelable,y:e.touches?.[0]?.clientY,state:document.querySelector('.pull-refresh')?.dataset.state})},true)}");awaitInputWindow(scenario);
        int[] origin=new int[2];float[] density=new float[1];
        assertTrue(withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(origin);density[0]=activity.getResources().getDisplayMetrics().density;}));
        float x=Float.parseFloat(evaluate(scenario,"innerWidth*.45"));
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).swipe(origin[0]+Math.round(x*density[0]),origin[1]+Math.round(65*density[0]),origin[0]+Math.round(x*density[0]),origin[1]+Math.round(230*density[0]),45));
    }
    @Test public void fourMainPagesPullSyncEvenWhenMotionIsDisabled() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);installSyncReviewFixture(scenario);
            for(String page:new String[]{"home","calendar","records","settings"}){
                evaluate(scenario,"document.querySelector('.bottom-nav [data-view="+page+"]').click()");
                waitTrue(scenario,"document.querySelector('.bottom-nav [aria-current=page]').dataset.view==='"+page+"'");
                evaluate(scenario,"window.__reviewHoldReads=true");nativePull(scenario);
                waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='syncing'");
                assertEquals("true",evaluate(scenario,"(()=>{const badge=document.querySelector('.cloud-sync-badge'),pull=document.querySelector('.pull-refresh');return document.body.classList.contains('motion-off')&&badge.dataset.source==='pull'&&getComputedStyle(badge.querySelector('svg')).animationName==='sync-spin'&&pull.dataset.state==='syncing'&&getComputedStyle(pull.querySelector('svg')).animationName==='sync-spin'})()"));
                evaluate(scenario,"window.__releaseReviewReads()");
                waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='success'&&document.querySelector('.pull-refresh').dataset.state==='success'");
                assertEquals("true",evaluate(scenario,"(()=>{const b=document.querySelector('.sync-cloud-button'),r=b.getBoundingClientRect(),data=JSON.parse(localStorage.getItem('dagongren.paybook.v1'));return r.width>=40&&r.height>=34&&r.right<=innerWidth&&getComputedStyle(b.querySelector('.cloud-sync-badge')).color==='rgb(22, 134, 82)'&&!data.defaults.motion&&!data.sync.auto&&window.__reviewWrites===0})()"));
                paintedScreenshot(scenario,"pull-sync-"+page);
            }
            assertEquals("4",evaluate(scenario,"window.__reviewReads"));
        }
    }
    @Test public void automaticSyncBadgesFollowRealResultAndMotionPreference() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);installSyncReviewFixture(scenario);
            evaluate(scenario,"window.__reviewHoldReads=true;document.querySelector('.sync-cloud-button').click();document.querySelector('[data-action=toggle-auto]').click()");
            waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='syncing'");
            assertEquals("true",evaluate(scenario,"document.querySelector('.cloud-sync-badge').dataset.source==='auto'&&getComputedStyle(document.querySelector('.cloud-sync-badge svg')).animationName==='none'"));
            evaluate(scenario,"window.__releaseReviewReads()");
            waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='success'");
            assertEquals("true",evaluate(scenario,"getComputedStyle(document.querySelector('.sync-result-stroke')).animationName==='none'"));
            evaluate(scenario,"document.querySelector('[data-action=toggle-auto]').click();window.__reviewFailure=true;document.querySelector('[data-action=toggle-auto]').click()");
            waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='error'");
            assertEquals("true",evaluate(scenario,"getComputedStyle(document.querySelector('.cloud-sync-badge')).color==='rgb(216, 68, 78)'&&window.__reviewWrites===0"));
            paintedScreenshot(scenario,"cloud-sync-error");
            evaluate(scenario,"document.querySelector('[data-action=toggle-auto]').click();window.__reviewFailure=false;document.querySelector('[data-view=home]').click()");
            nativePull(scenario);waitTrue(scenario,"document.querySelector('.cloud-sync-badge').dataset.state==='success'");
        }
    }
    @Test public void pullThresholdCancellationScrollingAndUnconfiguredCloudStaySafe() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);installSyncReviewFixture(scenario);
            evaluate(scenario,"window.__pullNode=document.querySelector('.topbar');window.__pullEvent=(type,x,y)=>window.__pullNode.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'mouse',pointerId:795,isPrimary:true,button:0,clientX:x,clientY:y}));window.__pullEvent('pointerdown',180,70);window.__pullEvent('pointermove',180,100);window.__pullEvent('pointerup',180,100)");
            assertEquals("0",evaluate(scenario,"window.__reviewReads"));
            evaluate(scenario,"window.__pullEvent('pointerdown',180,70);window.__pullEvent('pointermove',180,190);window.__pullEvent('pointercancel',180,190)");
            assertEquals("0",evaluate(scenario,"window.__reviewReads"));
            evaluate(scenario,"window.scrollTo({top:150,behavior:'instant'});window.__pullEvent('pointerdown',180,70);window.__pullEvent('pointermove',180,200);window.__pullEvent('pointerup',180,200)");
            assertEquals("0",evaluate(scenario,"window.__reviewReads"));
            evaluate(scenario,"window.scrollTo({top:0,behavior:'instant'});window.__pullEvent('pointerdown',180,70);window.__pullEvent('pointermove',180,200);window.__pullEvent('pointerup',180,200)");
            waitTrue(scenario,"window.__reviewReads===1&&document.querySelector('.cloud-sync-badge').dataset.state==='success'");
        }
    }
    private void slowNativeDrag(ActivityScenario<MainActivity> scenario,String selector,String kind) throws Exception {
        evaluate(scenario,"document.querySelector('"+selector+"').scrollIntoView({block:'center',behavior:'instant'})");awaitInputWindow(scenario);
        waitTrue(scenario,"Boolean(document.querySelector('"+(kind.equals("page")?".page-swipe-preload":".calendar-swipe-preload")+"'))");
        evaluate(scenario,"performance.clearMarks('dagongren."+kind+".input-commit');performance.clearMarks('dagongren."+kind+".first-frame');performance.mark('review.drag.ready')");
        JSONObject rect=new JSONObject(new org.json.JSONTokener(evaluate(scenario,"JSON.stringify((()=>{const r=document.querySelector('"+selector+"').getBoundingClientRect();return {x:r.left+r.width*.7,y:Math.max(35,r.top+Math.min(50,r.height*.5))}})())")).nextValue().toString());
        int[] origin=new int[2];float[] density=new float[1];
        assertTrue(withActivity(activity->{WebView web=activity.findViewById(R.id.web_view);web.getLocationOnScreen(origin);density[0]=activity.getResources().getDisplayMetrics().density;}));
        int x=origin[0]+Math.round((float)rect.getDouble("x")*density[0]),y=origin[1]+Math.round((float)rect.getDouble("y")*density[0]);
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).swipe(x,y,x-Math.round(60*density[0]),y,240));
        waitTrue(scenario,"performance.getEntriesByName('dagongren."+kind+".first-frame').length>0&&!document.getElementById('app').classList.contains('swipe-busy')");
        assertEquals("true",evaluate(scenario,"(()=>{const input=performance.getEntriesByName('dagongren."+kind+".input-commit').at(-1)?.detail,frame=performance.getEntriesByName('dagongren."+kind+".first-frame').at(-1)?.detail;return input?.prepared&&frame?.prepared&&input.raf&&input.callbackWork<50&&input.eventToCommit>=0})()"));
        android.util.Log.i("DagongrenMotion","SLOW_DRAG_WEB_"+kind.toUpperCase()+"="+evaluate(scenario,"JSON.stringify({commit:performance.getEntriesByName('dagongren."+kind+".input-commit').at(-1).detail,nextFrame:performance.getEntriesByName('dagongren."+kind+".first-frame').at(-1).detail,preparation:performance.getEntriesByName('dagongren."+kind+".prepare').at(-1)?.detail})"));
    }
    @Test public void slowNativeSwipesReportInputAndFrameCostsWithoutTouchPreparation() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            resetBook(scenario);
            android.os.HandlerThread thread=new android.os.HandlerThread("frame-review");thread.start();
            java.util.List<long[]> samples=new java.util.concurrent.CopyOnWriteArrayList<>();
            android.view.Window.OnFrameMetricsAvailableListener listener=(window,metrics,dropped)->samples.add(new long[]{metrics.getMetric(android.view.FrameMetrics.TOTAL_DURATION),metrics.getMetric(android.view.FrameMetrics.INPUT_HANDLING_DURATION),metrics.getMetric(android.view.FrameMetrics.LAYOUT_MEASURE_DURATION),metrics.getMetric(android.view.FrameMetrics.DRAW_DURATION),metrics.getMetric(android.view.FrameMetrics.SYNC_DURATION),dropped});
            withActivity(activity->activity.getWindow().addOnFrameMetricsAvailableListener(listener,new android.os.Handler(thread.getLooper())));
            try{
                slowNativeDrag(scenario,".topbar","page");
                evaluate(scenario,"document.querySelector('.bottom-nav [data-view=calendar]').click()");waitTrue(scenario,"Boolean(document.querySelector('#app .view-calendar'))&&!document.getElementById('app').classList.contains('swipe-busy')");
                slowNativeDrag(scenario,".calendar-days","calendar");
                assertFalse("No native frame metrics were captured",samples.isEmpty());
                org.json.JSONArray report=new org.json.JSONArray();for(long[] sample:samples)report.put(new org.json.JSONArray(sample));
                android.util.Log.i("DagongrenMotion","SLOW_DRAG_NATIVE_FRAME_NS="+report);
            }finally{withActivity(activity->activity.getWindow().removeOnFrameMetricsAvailableListener(listener));thread.quitSafely();}
        }
    }


}
