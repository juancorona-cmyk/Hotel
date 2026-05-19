package com.hotelpuntagaleria.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureNotificationChannel();
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                "hpg_notif", "Hotel Punta Galería", NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Nuevos registros y pagos");
            ch.enableVibration(true);
            ch.enableLights(true);
            ch.setShowBadge(true);
            nm.createNotificationChannel(ch);
        }
    }
}
