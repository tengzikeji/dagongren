package com.tengzikeji.dagongren;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;
final class HolidayClient {
 private static final int LIMIT=256*1024;
 private final OkHttpClient client;
 HolidayClient(){client=new OkHttpClient.Builder().connectTimeout(8,TimeUnit.SECONDS).readTimeout(12,TimeUnit.SECONDS).callTimeout(20,TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).build();}
 JSONObject readYear(int year) throws Exception {
  if(year<2020||year>2040)throw new IllegalArgumentException("日历年份超出支持范围。");
  String[] urls={"https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/"+year+".json","https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/"+year+".json"};Exception last=null;
  for(String url:urls){
   try(Response response=client.newCall(new Request.Builder().url(url).header("User-Agent","Dagongren/1.1.0").header("Cache-Control","no-cache").build()).execute()){
    if(response.code()==404)continue;
    if(response.code()!=200||response.body()==null||response.body().contentLength()>LIMIT)throw new IOException("日历资料暂时无法读取。");
    JSONObject data=new JSONObject(readBounded(response.body().byteStream()));
    if(data.optInt("year")!=year)throw new IOException("日历资料年份不匹配。");
    JSONArray papers=data.optJSONArray("papers"),days=data.optJSONArray("days");
    if(papers!=null&&days!=null&&papers.length()==0&&days.length()==0)continue;
    validate(data,year);return new JSONObject().put("available",true).put("payload",data).put("source","NateScarlet/holiday-cn");
   }catch(Exception error){last=error;}
  }
  if(last!=null)throw new IOException("日历联网更新未完成，继续使用已缓存的资料。",last);
  return new JSONObject().put("available",false);
 }
 static void validate(JSONObject data,int year) throws Exception {
  JSONArray papers=data.optJSONArray("papers"),days=data.optJSONArray("days");
  if(data.optInt("year")!=year||papers==null||papers.length()<1||papers.length()>20||days==null||days.length()<1||days.length()>120)throw new IOException("日历资料不完整。");
  for(int i=0;i<papers.length();i++){HttpUrl url=HttpUrl.get(papers.getString(i));if(!url.isHttps()||!(url.host().equals("gov.cn")||url.host().endsWith(".gov.cn"))||papers.getString(i).length()>2048)throw new IOException("日历资料缺少可追溯的政府通知。");}
  Set<String> seen=new HashSet<>();
  for(int i=0;i<days.length();i++){
   JSONObject row=days.getJSONObject(i);String date=row.getString("date"),name=row.getString("name");LocalDate parsed=LocalDate.parse(date);
   if(!date.equals(parsed.toString())||!(parsed.getYear()==year||(parsed.getYear()==year-1&&parsed.getMonthValue()==12))||name.trim().isEmpty()||name.length()>30||!(row.get("isOffDay") instanceof Boolean)||!seen.add(date))throw new IOException("日历日期资料无效或重复。");
  }
 }
 private static String readBounded(InputStream input) throws Exception {
  try(InputStream stream=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[4096];int count,total=0;while((count=stream.read(buffer))!=-1){total+=count;if(total>LIMIT)throw new IOException("日历资料超过大小限制。");out.write(buffer,0,count);}return out.toString(StandardCharsets.UTF_8.name());}
 }
}
