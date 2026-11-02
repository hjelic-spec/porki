package hr.lchf.dnevnik

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Widget za početni zaslon: post (timer, faza, pokretanje), težina, UH danas i brzi unos. */
class PorkiWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, build(context)) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_FAST_START -> startFast(context)
            ACTION_TICK -> refreshAll(context)
            ACTION_FAST_GOAL -> {
                val p = prefs(context)
                val start = intent.getLongExtra("start", 0L)
                // Obavijest samo za post pokrenut s widgeta (inače je zakazuje aplikacija)
                if (start > 0 && p.getLong("fastStart", 0L) == start && p.getBoolean("nativeNotify", false)) {
                    p.edit().putBoolean("nativeNotify", false).apply()
                    notifyGoal(context, p.getFloat("fastGoal", 16f))
                }
                refreshAll(context)
            }
            else -> super.onReceive(context, intent)
        }
    }

    companion object {
        const val PREFS = "porki_widget"
        private const val ACTION_FAST_START = "hr.lchf.dnevnik.WIDGET_FAST_START"
        private const val ACTION_FAST_GOAL = "hr.lchf.dnevnik.WIDGET_FAST_GOAL"
        private const val ACTION_TICK = "hr.lchf.dnevnik.WIDGET_TICK"
        private const val CHANNEL = "porki_fast"
        private val HR: Locale = Locale.forLanguageTag("hr-HR")
        // Jezik aplikacije (WidgetBridge.update šalje "lang"); postavlja se na početku build() i notifyGoal()
        private var en = false
        private fun tr(hr: String, en: String) = if (this.en) en else hr
        private fun loc(): Locale = if (en) Locale.UK else HR
        private val PHASES = listOf(
            0.0 to ("Probava zadnjeg obroka" to "Digesting the last meal"),
            4.0 to ("Inzulin pada, troši se glikogen" to "Insulin falls, glycogen is used"),
            12.0 to ("Pojačano sagorijevanje masti i ketoni" to "More fat burning and ketones"),
            18.0 to ("Duboka ketoza" to "Deep ketosis"),
            24.0 to ("Produženi post – pij vodu i elektrolite" to "Extended fast – drink water, electrolytes")
        )

        private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, PorkiWidget::class.java))
            if (ids.isNotEmpty()) {
                val views = build(context)
                ids.forEach { manager.updateAppWidget(it, views) }
            }
        }

        /** Post pokrenut izravno s widgeta; aplikacija ga preuzme pri sljedećem otvaranju. */
        private fun startFast(context: Context) {
            val p = prefs(context)
            if (p.getLong("fastStart", 0L) > 0L) return refreshAll(context)
            val now = System.currentTimeMillis()
            p.edit().putLong("fastStart", now).putString("fastPhase", "fast").putLong("pendingFastStart", now).putBoolean("nativeNotify", true).commit()
            refreshAll(context)
        }

        private fun notifyGoal(context: Context, goal: Float) {
            en = prefs(context).getString("lang", "hr") == "en"
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, tr("Post", "Fasting"), NotificationManager.IMPORTANCE_DEFAULT))
            val open = launch(context, "fast", 4)
            val n = NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(tr("Post je završen", "Fast complete"))
                .setContentText(tr("Cilj od ${Math.round(goal)} h je ostvaren. Vrijeme za obrok!", "Your ${Math.round(goal)} h goal is reached. Time to eat!"))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
            try { nm.notify(1602, n) } catch (_: SecurityException) { /* nema dozvole za obavijesti */ }
        }

        private fun launch(context: Context, action: String, code: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .setAction("hr.lchf.dnevnik.WIDGET_$action")
                .putExtra("widget_action", action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun broadcast(context: Context, action: String, code: Int, start: Long = 0L): PendingIntent {
            val intent = Intent(context, PorkiWidget::class.java).setAction(action).putExtra("start", start)
            return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        /** Osvježi widget (i po potrebi pošalji obavijest) u trenutku kad je cilj posta ostvaren. */
        private fun scheduleGoal(context: Context, start: Long, goalAt: Long) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = broadcast(context, ACTION_FAST_GOAL, 10, start)
            if (start <= 0L || goalAt <= System.currentTimeMillis()) { am.cancel(pi); return }
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, goalAt, pi)
        }

        /** Osvježavanje prikaza posta svake minute; nebudeći alarm, pa ne troši bateriju dok je zaslon ugašen. */
        private fun scheduleTick(context: Context, start: Long) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = broadcast(context, ACTION_TICK, 11)
            if (start <= 0L) { am.cancel(pi); return }
            val now = System.currentTimeMillis()
            val next = start + ((now - start) / 60_000 + 1) * 60_000
            am.setWindow(AlarmManager.RTC, next, 10_000, pi)
        }

        private fun signed(x: Double, dec: Int): String =
            (if (x > 0) "+" else if (x < 0) "−" else "±") + String.format(loc(), "%.${dec}f", Math.abs(x))

        private fun shortDay(iso: String): String =
            iso.split("-").let { if (it.size == 3) (if (en) "${it[2].toInt()}/${it[1].toInt()}" else "${it[2].toInt()}.${it[1].toInt()}.") else "" }

        private fun goalLabel(goal: Double): String {
            val g = Math.round(goal).toInt()
            return if (g >= 24 || g <= 0) "$g h" else "$g:${24 - g}"
        }

        private fun hours(ms: Long): String {
            val m = ms / 60000
            return "${m / 60} h ${String.format(HR, "%02d", m % 60)} min"
        }

        private fun whenTxt(t: Long, today: String): String {
            val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(t))
            val hm = SimpleDateFormat("HH:mm", HR).format(Date(t))
            return if (day == today) hm else SimpleDateFormat(if (en) "d/M" else "d.M.", HR).format(Date(t)) + " " + hm
        }

        fun build(context: Context): RemoteViews {
            val p = prefs(context)
            en = p.getString("lang", "hr") == "en"
            val v = RemoteViews(context.packageName, R.layout.widget_porki)
            val now = System.currentTimeMillis()
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(now))

            // Post
            val start = p.getLong("fastStart", 0L)
            val goal = p.getFloat("fastGoal", 16f).toDouble()
            v.setTextViewText(R.id.w_fast_label, tr("Post", "Fast") + " ${goalLabel(goal)}")
            if (start > 0 && start <= now) {
                // post traje do prvog obroka; prozor za jelo traje 24 − cilj sati, zatim novi post od zadnjeg obroka
                val fastMs = (goal * 3600_000).toLong()
                val eatMs = if (goal < 24) ((24 - goal) * 3600_000).toLong() else 0L
                var phase = p.getString("fastPhase", "fast") ?: "fast"
                var ps = start
                var cycle = 1
                if (phase == "eat" && eatMs > 0 && now >= ps + eatMs) {
                    val last = p.getLong("lastMeal", 0L)
                    ps = if (last in ps..(ps + eatMs)) last else ps + eatMs
                    phase = "fast"; cycle = 2
                }
                val eating = phase == "eat"
                val el = now - ps
                val done = !eating && el >= fastMs
                val pct = if (eating) (((ps + eatMs - now) * 1000) / eatMs).coerceIn(0, 1000).toInt()
                          else ((el * 1000) / fastMs).coerceIn(0, 1000).toInt()
                v.setViewVisibility(R.id.w_clock, View.VISIBLE)
                v.setViewVisibility(R.id.w_fast_off, View.GONE)
                v.setViewVisibility(R.id.w_fast_phase, View.VISIBLE)
                val green = eating || done
                v.setViewVisibility(R.id.w_progress, if (green) View.GONE else View.VISIBLE)
                v.setViewVisibility(R.id.w_progress_eat, if (green) View.VISIBLE else View.GONE)
                v.setProgressBar(if (green) R.id.w_progress_eat else R.id.w_progress, 1000, pct, false)
                val shown = if (eating) ps + eatMs - now else el
                val mins = shown / 60_000
                v.setTextViewText(R.id.w_clock, if (mins >= 600) "${mins / 60}h ${String.format(HR, "%02d", mins % 60)}m" else "${mins / 60} h ${String.format(HR, "%02d", mins % 60)} min")
                v.setTextColor(R.id.w_clock, ContextCompat.getColor(context, if (green) R.color.w_good else R.color.w_fast))
                v.setTextViewText(R.id.w_fast_label, when { eating -> tr("Jelo, još", "Eating, left"); done -> tr("Možeš jesti", "You can eat"); else -> tr("Post", "Fast") + " ${goalLabel(goal)}" })
                v.setTextViewText(
                    R.id.w_fast_info,
                    when {
                        eating -> tr("Jelo do ${whenTxt(ps + eatMs, today)} · zatim post ${Math.round(goal)} h", "Eat until ${whenTxt(ps + eatMs, today)} · then a ${Math.round(goal)} h fast")
                        done -> tr("Cilj ostvaren ${whenTxt(ps + fastMs, today)} · +${hours(el - fastMs)}", "Goal reached ${whenTxt(ps + fastMs, today)} · +${hours(el - fastMs)}")
                        else -> tr("Početak ${whenTxt(ps, today)} · cilj ${whenTxt(ps + fastMs, today)}", "Started ${whenTxt(ps, today)} · goal ${whenTxt(ps + fastMs, today)}")
                    }
                )
                v.setTextViewText(R.id.w_fast_phase, when {
                    eating -> tr("Prozor za jelo · novi post od zadnjeg obroka", "Eating window · new fast from the last meal")
                    done && eatMs > 0 -> tr("Brojač ide dalje do prvog obroka", "Timer keeps running until the first meal")
                    else -> PHASES.last { el / 3600_000.0 >= it.first }.second.let { tr(it.first, it.second) }
                })
                if (done && eatMs > 0) {
                    v.setTextViewText(R.id.w_fast_btn, tr("Jedem", "Eat"))
                    v.setOnClickPendingIntent(R.id.w_fast_btn, launch(context, "fast_eat", 9))
                } else {
                    v.setTextViewText(R.id.w_fast_btn, tr("Završi", "End"))
                    v.setOnClickPendingIntent(R.id.w_fast_btn, launch(context, "fast_end", 5))
                }
                scheduleTick(context, ps)
                scheduleGoal(context, start, if (eating) ps + eatMs else ps + fastMs)
            } else {
                scheduleTick(context, 0L)
                v.setViewVisibility(R.id.w_clock, View.GONE)
                v.setViewVisibility(R.id.w_fast_off, View.VISIBLE)
                v.setTextViewText(R.id.w_fast_off, tr("nije aktivan", "not active"))
                v.setViewVisibility(R.id.w_progress, View.GONE)
                v.setViewVisibility(R.id.w_progress_eat, View.GONE)
                v.setViewVisibility(R.id.w_fast_phase, View.GONE)
                v.setTextViewText(R.id.w_fast_info, tr("Cilj ${Math.round(goal)} h · Započni pokreće post odmah", "Goal ${Math.round(goal)} h · Start begins the fast now"))
                v.setTextViewText(R.id.w_fast_btn, tr("Započni", "Start"))
                v.setOnClickPendingIntent(R.id.w_fast_btn, broadcast(context, ACTION_FAST_START, 6))
                scheduleGoal(context, 0L, 0L)
            }

            // Težina i promjena u odnosu na prethodno mjerenje
            val weight = p.getFloat("weight", 0f)
            val color = { id: Int -> ContextCompat.getColor(context, id) }
            if (weight > 0f) {
                v.setTextViewText(R.id.w_weight, String.format(loc(), "%.1f kg", weight))
                val wd = p.getString("weightDate", "") ?: ""
                if (p.contains("weightDiff")) {
                    val d = p.getFloat("weightDiff", 0f)
                    val ref = p.getString("weightDiffRef", "") ?: ""
                    val day = if (wd == today) "" else "${shortDay(wd)}: "
                    v.setTextViewText(R.id.w_weight_info, "$day${signed(d.toDouble(), 1)} kg " + tr("od", "since") + " $ref")
                    v.setTextColor(R.id.w_weight_info, color(if (d < 0f) R.color.w_good else if (d > 0f) R.color.w_bad else R.color.w_muted))
                } else {
                    v.setTextViewText(R.id.w_weight_info, if (wd == today) tr("danas", "today") else shortDay(wd))
                    v.setTextColor(R.id.w_weight_info, color(R.color.w_muted))
                }
            } else {
                v.setTextViewText(R.id.w_weight, "– kg")
                v.setTextViewText(R.id.w_weight_info, tr("još nema mjerenja", "no weigh-ins yet"))
                v.setTextColor(R.id.w_weight_info, color(R.color.w_muted))
            }

            // Očekivana promjena prema kalorijskoj bilanci (7700 kcal ≈ 1 kg masnog tkiva)
            val fresh = p.getString("balDate", "") == today
            val parts = mutableListOf<String>()
            var tone = 0f
            if (fresh && p.contains("balToday")) {
                val bt = p.getFloat("balToday", 0f).toDouble()
                parts += tr("danas", "today") + " ${signed(bt, 0)} kcal ≈ ${signed(bt / 7700, 2)} kg"
                tone = bt.toFloat()
            }
            if (fresh && p.contains("balWeek")) {
                val bw = p.getFloat("balWeek", 0f).toDouble()
                parts += "${p.getInt("balWeekDays", 7)} d ≈ ${signed(bw / 7700, 2)} kg"
                tone = bw.toFloat()
            }
            if (parts.isEmpty()) {
                v.setTextViewText(R.id.w_balance, tr("Bilanca: unesi hranu i potrošnju", "Balance: log food and calories burned"))
                v.setTextColor(R.id.w_balance, color(R.color.w_muted))
            } else {
                v.setTextViewText(R.id.w_balance, tr("Bilanca ", "Balance ") + parts.joinToString(" · "))
                v.setTextColor(R.id.w_balance, color(if (tone < 0f) R.color.w_good else if (tone > 0f) R.color.w_bad else R.color.w_muted))
            }

            // Neto UH danas (crveno iznad limita)
            val carbs = if (p.getString("carbDate", "") == today) p.getFloat("carbs", 0f) else 0f
            val limit = p.getFloat("carbLimit", 25f)
            v.setTextViewText(R.id.w_carbs, String.format(loc(), tr("UH", "Carbs") + " %.0f / %.0f g", carbs, limit))
            v.setTextColor(R.id.w_carbs, ContextCompat.getColor(context, if (carbs > limit) R.color.w_bad else R.color.w_muted))

            v.setOnClickPendingIntent(R.id.w_fast, launch(context, "fast", 1))
            // Ketoni (zadnja trakica) i proteini danas
            val ketText = p.getString("ketText", "") ?: ""
            if (ketText.isNotEmpty()) {
                val kd = p.getString("ketDate", "") ?: ""
                val ago = when (kd) {
                    today -> tr("danas", "today")
                    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(now - 86_400_000)) -> tr("jučer", "yesterday")
                    else -> shortDay(kd)
                }
                val time = p.getString("ketTime", "") ?: ""
                val glu = if (p.getBoolean("gluWarn", false)) tr(" · glukoza!", " · glucose!") else ""
                v.setTextViewText(R.id.w_ket, tr("Ketoni", "Ketones") + " $ketText · ${if (kd == today && time.isNotEmpty()) time else ago}$glu")
                v.setTextColor(R.id.w_ket, color(if (glu.isNotEmpty()) R.color.w_bad else R.color.w_ink))
                v.setViewVisibility(R.id.w_ket_dot, View.VISIBLE)
                v.setInt(R.id.w_ket_dot, "setColorFilter", p.getInt("ketColor", 0xFFEFE3C9.toInt()))
            } else {
                v.setViewVisibility(R.id.w_ket_dot, View.GONE)
                v.setTextViewText(R.id.w_ket, tr("Ketoni: još nema mjerenja", "Ketones: no readings yet"))
                v.setTextColor(R.id.w_ket, color(R.color.w_muted))
            }
            val prot = if (p.getString("carbDate", "") == today) p.getFloat("protein", 0f) else 0f
            val protTarget = p.getFloat("proteinTarget", 0f)
            v.setTextViewText(R.id.w_protein, if (protTarget > 0f) String.format(HR, "P %.0f / %.0f g", prot, protTarget) else String.format(HR, "P %.0f g", prot))
            v.setTextColor(R.id.w_protein, color(if (protTarget > 0f && prot >= protTarget) R.color.w_good else R.color.w_muted))

            // Dodiri: težina → unos kg, UH → dodaj hranu, ostalo → aplikacija
            v.setOnClickPendingIntent(R.id.w_weight_row, launch(context, "weight", 2))
            v.setOnClickPendingIntent(R.id.w_carbs, launch(context, "food", 3))
            v.setOnClickPendingIntent(R.id.w_balance, launch(context, "today", 7))
            v.setOnClickPendingIntent(R.id.w_ket_row, launch(context, "ketones", 8))
            return v
        }
    }
}
