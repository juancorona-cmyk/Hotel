package com.hotelpuntagaleria.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// Servicio FCM independiente — extiende FirebaseMessagingService directamente
// para funcionar sin el bridge de Capacitor (funciona con la app cerrada).
// Firebase llama a ESTE servicio Y al de Capacitor por separado, así que
// los eventos JS de primer plano siguen funcionando sin que tengamos que reenviarlos.
public class HotelMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        showSystemNotification(remoteMessage);
    }

    private void showSystemNotification(RemoteMessage message) {
        Map<String, String> data = message.getData();

        String title = data.containsKey("title") ? data.get("title") : "Hotel Punta Galería";
        String body  = data.containsKey("body")  ? data.get("body")  : "Nuevo registro recibido";
        String url   = data.containsKey("url")   ? data.get("url")   : "";

        RemoteMessage.Notification notif = message.getNotification();
        if (notif != null) {
            if (notif.getTitle() != null) title = notif.getTitle();
            if (notif.getBody()  != null) body  = notif.getBody();
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Crear canal si no existe (idempotente)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel("hotel_push") == null) {
                NotificationChannel ch = new NotificationChannel(
                    "hotel_push", "Hotel Punta Galería", NotificationManager.IMPORTANCE_HIGH
                );
                ch.enableVibration(true);
                ch.enableLights(true);
                nm.createNotificationChannel(ch);
            }
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!url.isEmpty()) intent.setData(Uri.parse(url));

        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);

        PendingIntent tap = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "hotel_push")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(tap)
            .setVibrate(new long[]{0, 400, 200, 400});

        nm.notify((int)(System.currentTimeMillis() % Integer.MAX_VALUE), builder.build());
    }
}
