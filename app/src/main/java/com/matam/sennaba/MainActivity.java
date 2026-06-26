package com.matam.sennaba;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class MainActivity extends Activity {
    private WebView web;
    private static final String CHANNEL_ID = "msn_reminders";
    private static final int REQ_LOCATION = 1;
    private static final int REQ_NOTIF    = 2;
    private static final int RC_SIGN_IN   = 9001;
    private int notifId = 1000;

    private String webClientId = null;
    private GoogleSignInClient mGoogleSignInClient = null;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        createNotificationChannel();

        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setGeolocationEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.addJavascriptInterface(new AndroidBridge(), "AndroidNotif");
        web.addJavascriptInterface(new AndroidAuth(),   "AndroidAuth");

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }
        });

        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQ_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }

        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    // ===== NOTIFICATION CHANNEL =====

    private void createNotificationChannel() {
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("MATAM SEN-NABA reminder alerts");
        ch.enableVibration(true);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(ch);
    }

    // ===== NOTIFICATION BRIDGE =====

    private class AndroidBridge {

        @JavascriptInterface
        public boolean hasPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
            }
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            return nm.areNotificationsEnabled();
        }

        @JavascriptInterface
        public void requestPermission() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
            }
        }

        @JavascriptInterface
        public void showNotification(String title, String body) {
            Intent intent = new Intent(MainActivity.this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                    MainActivity.this, notifId, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification notif = new Notification.Builder(MainActivity.this, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setContentIntent(pi)
                    .setAutoCancel(true)
                    .build();

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify(notifId++, notif);
        }
    }

    // ===== GOOGLE SIGN-IN BRIDGE =====

    private class AndroidAuth {

        // JS calls this first with the web client ID from FIREBASE_CONFIG
        @JavascriptInterface
        public void setWebClientId(String clientId) {
            webClientId = clientId;
            runOnUiThread(() -> {
                GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(clientId)
                        .requestEmail()
                        .requestProfile()
                        .build();
                mGoogleSignInClient = GoogleSignIn.getClient(MainActivity.this, gso);

                // Auto-sign-in if the user was already signed in before
                trySilentSignIn();
            });
        }

        @JavascriptInterface
        public void signIn() {
            if (mGoogleSignInClient == null) return;
            runOnUiThread(() -> {
                Intent intent = mGoogleSignInClient.getSignInIntent();
                startActivityForResult(intent, RC_SIGN_IN);
            });
        }

        @JavascriptInterface
        public void signOut() {
            if (mGoogleSignInClient == null) return;
            mGoogleSignInClient.signOut().addOnCompleteListener(MainActivity.this, task ->
                runJs("window._onGoogleSignOut && window._onGoogleSignOut()"));
        }
    }

    // ===== SIGN-IN RESULT =====

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount acct = task.getResult(ApiException.class);
                notifySignedIn(acct);
            } catch (ApiException e) {
                int code = e.getStatusCode();
                String detail = esc(e.getMessage());
                runJs("window._onGoogleSignInError && window._onGoogleSignInError(" + code + ",'" + detail + "')");
            }
        }
    }

    private void trySilentSignIn() {
        if (mGoogleSignInClient == null) return;
        mGoogleSignInClient.silentSignIn().addOnCompleteListener(this, task -> {
            if (task.isSuccessful()) {
                // Delay slightly so WebView has time to finish loading JS
                web.postDelayed(() -> notifySignedIn(task.getResult()), 1200);
            }
        });
    }

    private void notifySignedIn(GoogleSignInAccount acct) {
        if (acct == null) return;
        String idToken = acct.getIdToken() != null ? acct.getIdToken() : "";
        String email   = esc(acct.getEmail());
        String name    = esc(acct.getDisplayName());
        String photo   = acct.getPhotoUrl() != null ? acct.getPhotoUrl().toString() : "";
        String js = "window._onGoogleSignIn && window._onGoogleSignIn({"
                + "idToken:'" + idToken + "',"
                + "email:'"   + email   + "',"
                + "name:'"    + name    + "',"
                + "photo:'"   + photo   + "'"
                + "})";
        runJs(js);
    }

    private void runJs(String js) {
        web.post(() -> web.evaluateJavascript(js, null));
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'");
    }

    // ===== BACK BUTTON =====

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
