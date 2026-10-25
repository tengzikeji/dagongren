package com.tengzikeji.dagongren;

import static org.junit.Assert.*;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class WebDavClientTest {
    private MockWebServer server;
    @Before public void start() throws Exception { server=new MockWebServer();server.start(); }
    @After public void stop() throws Exception { server.shutdown(); }
    private JSONObject config() throws Exception { return new JSONObject().put("url",server.url("/dav/").toString()).put("username","example@example.invalid").put("password","test-only-not-real").put("path","dagongren/paybook.json"); }
    private WebDavClient client() throws Exception { return new WebDavClient(config(),new OkHttpClient.Builder().followRedirects(false).build(),true); }
    @Test public void connectionUsesPropfindAndAuthorization() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(207));client().testConnection();
        RecordedRequest request=server.takeRequest(3,TimeUnit.SECONDS);
        assertEquals("PROPFIND",request.getMethod());assertEquals("0",request.getHeader("Depth"));assertTrue(request.getHeader("Authorization").startsWith("Basic "));
    }
    @Test public void unauthorizedDoesNotReportSuccess() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(401));
        try{client().testConnection();fail();}catch(java.io.IOException expected){assertTrue(expected.getMessage().contains("应用密码"));assertFalse(expected.getMessage().contains("test-only"));}
    }
    @Test public void missingRemoteIsExplicit() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(404));assertFalse(client().read().getBoolean("exists"));
    }
    @Test public void readPreservesVersionAndData() throws Exception {
        server.enqueue(new MockResponse().setBody("{\"format\":\"dagongren.webdav.v2\",\"book\":{\"version\":2}}").addHeader("ETag","\"rev-1\""));
        JSONObject result=client().read();assertTrue(result.getBoolean("exists"));assertEquals("\"rev-1\"",result.getString("etag"));assertEquals(2,result.getJSONObject("envelope").getJSONObject("book").getInt("version"));
    }
    @Test public void invalidRemoteDoesNotBecomeAnEmptyBook() throws Exception {
        server.enqueue(new MockResponse().setBody("<html>login</html>"));
        try{client().read();fail();}catch(java.io.IOException expected){assertTrue(expected.getMessage().contains("不是有效账本"));}
    }
    private JSONObject payload(boolean exists) throws Exception {
        return new JSONObject().put("content",new JSONObject().put("version",2).put("defaults",new JSONObject()).put("months",new JSONObject()).toString()).put("exists",exists).put("etag",exists?"\"rev-1\"":"");
    }
    @Test public void createUsesNoOverwriteCondition() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(201));server.enqueue(new MockResponse().setResponseCode(201));
        assertTrue(client().write(payload(false)).getBoolean("saved"));
        assertEquals("MKCOL",server.takeRequest().getMethod());RecordedRequest put=server.takeRequest();
        assertEquals("PUT",put.getMethod());assertEquals("*",put.getHeader("If-None-Match"));assertNull(put.getHeader("If-Match"));
        JSONObject envelope=new JSONObject(put.getBody().readUtf8());assertEquals("dagongren.webdav.v2",envelope.getString("format"));assertFalse(envelope.toString().contains("password"));
    }
    @Test public void updateChecksTheVersionReadEarlier() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(204));client().write(payload(true));RecordedRequest put=server.takeRequest();assertEquals("\"rev-1\"",put.getHeader("If-Match"));assertEquals("PUT",put.getMethod());
    }
    @Test public void concurrentChangeIsNeverSuccess() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(412));
        try{client().write(payload(true));fail();}catch(java.io.IOException expected){assertTrue(expected.getMessage().contains("未覆盖"));}
    }
    @Test public void weakOrMissingVersionCannotOverwrite() throws Exception {
        for(String tag:new String[]{"","W/\"weak\""}){JSONObject data=payload(true).put("etag",tag);try{client().write(data);fail();}catch(java.io.IOException expected){assertTrue(expected.getMessage().contains("版本标识"));}}
        assertEquals(0,server.getRequestCount());
    }
    @Test public void rejectsUnsafePaths() {
        for(String path:new String[]{"../paybook.json","/paybook.json","x//paybook.json","x/../paybook.json","paybook.txt","x\\y.json"}){
            try{WebDavClient.validatePath(path);fail(path);}catch(IllegalArgumentException expected){}
        }
    }
    @Test public void productionRejectsUnencryptedService() throws Exception {
        try{new WebDavClient(config());fail();}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("HTTPS"));}
    }
    @Test public void quotaAndRateErrorsExplainFailure() {
        assertTrue(WebDavClient.failure(429).getMessage().contains("频繁"));assertTrue(WebDavClient.failure(507).getMessage().contains("空间不足"));
    }
}
