package com.tengzikeji.dagongren;

import android.app.UiModeManager;
import android.content.Context;
import android.os.Build;

final class NativeTheme {
    private NativeTheme(){}
    static void apply(Context context){apply(context,context.getSharedPreferences("appearance",Context.MODE_PRIVATE).getString("mode","system"));}
    static void apply(Context context,String mode){
        if(Build.VERSION.SDK_INT<31)return;
        UiModeManager manager=context.getSystemService(UiModeManager.class);
        if(manager!=null)manager.setApplicationNightMode("dark".equals(mode)?UiModeManager.MODE_NIGHT_YES:"light".equals(mode)?UiModeManager.MODE_NIGHT_NO:UiModeManager.MODE_NIGHT_AUTO);
    }
}
