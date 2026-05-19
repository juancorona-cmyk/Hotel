package com.hotelpuntagaleria.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createHotelPushChannel();
        requestBatteryOptimizationExclusion();
    }

    // Crear el canal desde el primer arranque — Android descarta notificaciones
    // a canales inexistentes, y el canal solo persiste tras crearse al menos una vez.
    private void createHotelPushChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            // Recrear siempre para asegurar importancia IMPORTANCE_HIGH
            NotificationChannel channel = new NotificationChannel(
                "hotel_push",
                "Hotel Punta Galería",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Nuevos registros y pagos");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setShowBadge(true);
            nm.createNotificationChannel(channel);
        }
    }

    // Solicitar exclusión de optimización de batería — necesario en muchos Android
    // (Samsung, Xiaomi, OPPO…) para que FCM entregue mensajes con la app cerrada.
    private void requestBatteryOptimizationExclusion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            String pkg = getPackageName();
            if (!pm.isIgnoringBatteryOptimizations(pkg)) {
                Intent intent = new Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + pkg)
                );
                startActivity(intent);
            }
        }
    }
}
