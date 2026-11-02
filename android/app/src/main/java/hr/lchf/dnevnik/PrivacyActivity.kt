package hr.lchf.dnevnik

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import java.util.Locale

/** Objašnjenje korištenja podataka – Health Connect ga prikazuje uz zahtjev za dozvolama. */
class PrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        web.fitsSystemWindows = true
        setContentView(web)
        // jezik aplikacije (sprema ga widget), inače jezik uređaja
        val lang = getSharedPreferences(PorkiWidget.PREFS, MODE_PRIVATE).getString("lang", null)
            ?: if (Locale.getDefault().language in listOf("hr", "bs", "sr")) "hr" else "en"
        web.loadUrl(if (lang == "en") "file:///android_asset/public/privacy-en.html" else "file:///android_asset/public/privacy.html")
    }
}
