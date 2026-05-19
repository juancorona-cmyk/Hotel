package com.hotelpuntagaleria.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// Extiende el servicio de Capacitor para que los eventos JS sigan funcionando
// cuando la app está en primer plano, y además muestra notificaciones del sistema
// cuando la app está en segundo plano o cerrada.
public class HotelMessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        // Dejar que Capacitor maneje el evento para los listeners JS en primer plano
        super.onMessageReceived(remoteMessage);

        // Mostrar notificación del sistema en TODOS los estados (primer/segundo plano y cerrada)
        showSystemNotification(remoteMessage);
    }

    private void showSystemNotification(RemoteMessage message) {
        Map<String, String> data = message.getData();

        String title = data.containsKey("title") ? data.get("title") : "Hotel Punta Galería";
        String body  = data.containsKey("body")  ? data.get("body")  : "Nuevo registro recibido";
        String url   = data.containsKey("url")   ? data.get("url")   : "";

        // También leer del campo notification si viene (compatibilidad)
        RemoteMessage.Notification notif = message.getNotification();
        if (notif != null) {
            if (notif.getTitle() != null) title = notif.getTitle();
            if (notif.getBody()  != null) body  = notif.getBody();
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!url.isEmpty()) {
            intent.setData(Uri.parse(url));
        }

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "hotel_push")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setVibrate(new long[]{0, 400, 200, 400})
            .setLights(0xFF5a6c1e, 300, 300);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            nm.notify(notifId, builder.build());
        }
    }
}
