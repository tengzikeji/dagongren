package com.tengzikeji.dagongren;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ThemeRestoreReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))NativeTheme.apply(context);
    }
}
