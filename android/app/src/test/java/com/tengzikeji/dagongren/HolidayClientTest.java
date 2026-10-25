package com.tengzikeji.dagongren;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import static org.junit.Assert.*;
public class HolidayClientTest {
 private JSONObject payload() throws Exception{return new JSONObject().put("year",2027).put("papers",new JSONArray().put("https://www.gov.cn/zhengce/test.htm")).put("days",new JSONArray().put(new JSONObject().put("date","2027-01-01").put("name","元旦").put("isOffDay",true)));}
 @Test public void acceptsTraceableSchedule() throws Exception{HolidayClient.validate(payload(),2027);}
 @Test public void rejectsEmptyUnannouncedYear() throws Exception{JSONObject p=payload().put("papers",new JSONArray()).put("days",new JSONArray());assertThrows(Exception.class,()->HolidayClient.validate(p,2027));}
 @Test public void rejectsFalseGovernmentHost() throws Exception{JSONObject p=payload().put("papers",new JSONArray().put("https://gov.cn.example.com/x"));assertThrows(Exception.class,()->HolidayClient.validate(p,2027));}
 @Test public void rejectsInvalidAndDuplicateDates() throws Exception{JSONObject p=payload();p.getJSONArray("days").getJSONObject(0).put("date","2027-02-30");assertThrows(Exception.class,()->HolidayClient.validate(p,2027));JSONObject d=payload();d.getJSONArray("days").put(d.getJSONArray("days").getJSONObject(0));assertThrows(Exception.class,()->HolidayClient.validate(d,2027));}
 @Test public void acceptsFollowingNoticeDecemberDays() throws Exception{JSONObject p=payload();p.getJSONArray("days").getJSONObject(0).put("date","2026-12-31");HolidayClient.validate(p,2027);}
}
