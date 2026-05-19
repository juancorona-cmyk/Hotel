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
        createHotelPushChannel();
    }

    // Crear el canal de notificación desde el primer arranque (antes de cualquier FCM).
    // Android descarta silenciosamente las notificaciones dirigidas a un canal inexistente,
    // por eso no podemos depender del JS (que corre después).
    private void createHotelPushChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            if (nm.getNotificationChannel("hotel_push") != null) return;
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
}
