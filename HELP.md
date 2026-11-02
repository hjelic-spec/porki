# Porki – user guide

Porki is a simple app for tracking weight and nutrition. It is built for LCHF and keto, and also supports moderate low-carb, Mediterranean, high-protein and balanced diets. It is available in English and Croatian.

All your data stays **on your device only**. Porki has no account and no server, and it does not send your data anywhere.

## Contents

- [Getting started](#getting-started)
- [Today](#today)
- [Food](#food)
- [Fasting](#fasting)
- [Weight](#weight)
- [Ketones](#ketones)
- [Recipes](#recipes)
- [Analysis](#analysis)
- [Email reports](#email-reports)
- [Health Connect (Android)](#health-connect-android)
- [Home screen widget (Android)](#home-screen-widget-android)
- [Backup and restore](#backup-and-restore)
- [Settings](#settings)
- [Questions and troubleshooting](#questions-and-troubleshooting)

## Getting started

### Install

**Android app (recommended)** – it reads calories, steps and weight from Health Connect automatically and has a home screen widget.

1. On your phone, open [Releases](https://github.com/hjelic-spec/porki/releases/latest) and download `porki.apk`.
2. Open the file and allow installation from that source when Android asks.
3. Open Porki and tap **Allow** to let it read data from Health Connect.

To update, install the new APK over the old one. Your data is kept.

**Web version** – [hjelic-spec.github.io/porki](https://hjelic-spec.github.io/porki/) works in any browser and can be added to your home screen. It cannot read Health Connect, so you enter calories burned yourself. The web version and the Android app keep **separate data**; move it with [backup and restore](#backup-and-restore).

### Language

On a new install Porki uses your phone's language: Croatian (and Bosnian or Serbian) gives Croatian, everything else gives English. You can change it at any time in **Settings → Language**.

### Set your diet and targets

On first start, tap **Set up** on the banner (or **Settings → diet → calculate targets**). Choose your diet and enter sex, age, height, weight, goal weight, activity and pace. Porki shows the calculated daily targets; tap **Apply** to use them.

How the targets are calculated:

- Daily energy = basal metabolic rate (Mifflin-St Jeor formula) × activity level − the deficit for the chosen pace (7700 kcal ≈ 1 kg of body fat).
- Calories never go below 1200 kcal (women) or 1500 kcal (men).
- Protein is based on your goal weight (but not below 80 % of your current weight). Carbs depend on the diet: 20 g for strict keto, 50 g for LCHF, 100 g for moderate low-carb; the other diets get carbs from the remaining calories.

You can change any target by hand later in **Settings → Daily targets**.

## Today

The **Today** tab shows one day; use **‹** and **›** at the top to move between days, or tap the date to pick one.

- **Fast** – the current fast or eating window (only on today's date). See [Fasting](#fasting).
- **Weight** – type your weight and tap **Save**. The 7-day average and the change per week are shown next to the title. Daily swings of 0.5–1.5 kg are normal; follow the average.
- **Macronutrients** – net carbs against your limit, protein, fat and calories for the day, with the share of calories from each.
- **Energy burned** – calories burned (from Health Connect or entered by you), calories eaten and the day's balance (deficit or surplus). **Manual** enters one day; **Past days** enters up to 90 days at once.
- **Keto-Diastix** – the latest ketone reading of the day.

## Food

Tap **+ Add food** (on Today or Food). You can:

- **Search** – type a few letters. Results come from your favourites, your saved foods, recently logged foods and the built-in food list.
- **Browse the food list** – about 150 foods in sections (meat and fish, eggs and dairy, fats, vegetables, nuts and seeds, fruit, drinks, extras). Foods marked **limit** or **avoid** depend on your chosen diet. By default only suitable foods are shown; **Show all** shows the rest.
- **Search online** – searches the [Open Food Facts](https://world.openfoodfacts.org) database (needs an internet connection).
- **Scan** – point the camera at a barcode. Porki looks the product up in Open Food Facts. If it is not found, enter the values from the label.
- **Enter manually** – type the name and values yourself.

In the food form you choose whether the values are **per 100 g** or for the whole serving, and enter the amount. The preview shows the calories and how much of your daily carb limit is left.

**Net carbs:** on EU labels "carbohydrate" already excludes fibre, so it is the net carbs. US labels include fibre; if you use US products, turn on **Settings → Carbs on labels include fibre** and Porki subtracts fibre for you.

Other buttons in the food form:

- **▥ Save to my foods** – keeps a scanned or typed product for later without logging it.
- **★ Favourite only** – adds it to favourites without logging it.
- **Save to favourites** (checkbox) – logs it and adds it to favourites.

The **Food** tab also shows your **last meal** (its macros and how the day stands afterwards), your **most-used foods** for one-tap logging, and all entries for the day. Tap an entry to edit or delete it; tap ★ to add it to favourites.

## Fasting

Porki follows your real meals:

1. Choose a goal (12:12 to 23:1, or a 24 h extended fast) and tap **Start now**, or **From last meal** to count from your last logged meal.
2. The fast lasts **until your first meal**. When you reach the goal, the timer keeps running and shows **You can eat**.
3. Logging a meal under Food (anything with 20 kcal or more; black coffee and water do not count) ends the fast and starts the **eating window**. You can also tap **Eating now**. If you eat before the goal, Porki asks whether to break the fast.
4. The eating window lasts 24 − goal hours (8 h for 16:8). When it ends, a new fast starts by itself, counted from your **last meal** in the window.
5. This repeats until you tap **End**.

**Start fast** during the eating window starts the next fast straight away, counted from your last meal (or from now if you have not logged one). **Edit** lets you change the phase, its start time or the goal. Every completed fast longer than 10 minutes is saved and shown in **Analysis**.

On Android you get a notification when the fasting goal is reached and when the eating window ends.

Fasting phases shown under the timer are general guidance: digesting the last meal (0 h), insulin falls and glycogen is used (4 h), increased fat burning and ketones (12 h), deep ketosis (18 h), extended fast (24 h+).

## Weight

The **Weight** tab shows a chart of your weigh-ins with the 7-day average (30 days to all time), and:

- current weight and change since your first weigh-in,
- the pace in kg per week over the last 3 weeks (a trend line through your weigh-ins),
- kg left to your goal and BMI (enter your height in Settings),
- when you will reach your goal at the current pace.

You can add a weight for any past date under **Add**. Weigh yourself at the same time each day, in the morning after the toilet.

## Ketones

For **Keto-Diastix** urine strips (ketones and glucose). Tap **+ New reading** and choose the colours that match your strip: read ketones after **15 seconds** and glucose after **30 seconds**. The tab shows the last 30 days and all readings.

- After a few weeks of keto adaptation the strips often show less, even if you are still in ketosis.
- Drinking a lot of water lowers the reading.
- Glucose in urine is not normal. If it happens again, or ketones are high together with glucose, see a doctor.

## Recipes

20 recipes with nutrition per serving, calculated from the food list. **For my diet** shows only recipes suitable for your diet; **All recipes** shows all of them. Open a recipe to see the ingredients and method, choose the number of servings and tap **Add to meal**.

## Analysis

The **Analysis** tab shows one week (Monday to Sunday); use **‹** and **›** to move between weeks.

- **Averages** – net carbs, fat, protein, calories eaten and burned, steps.
- **Insights** – days within your carb limit, protein against target, calorie split, energy balance, weight change, ketones.
- **Expected vs. actual** – the weight change your calorie balance predicts compared with what the scale shows.
- Charts and a table for each day, completed fasts and the last 8 weeks trend.

### Expected vs. actual

- **Expected change** = the sum of daily balances (food eaten − calories burned) ÷ 7700 kcal. Only days with both food and calories burned count; with 3 or more such days the average is scaled to the whole week.
- **Actual change** = this week's average weight minus last week's average.

They rarely match exactly. The scale also measures water, glycogen, gut contents and salt; smartwatches often overestimate calories burned by 10–30 %, and food intake is easy to underestimate. Look at the trend over 3–4 weeks rather than a single week.

The **Health** section warns about a very large deficit, losing more than 1 % of body weight a week, low protein, or several days under 1200 kcal.

The advice in Porki is general guidance, not medical advice. If you take medication for blood sugar or blood pressure, talk to your doctor before starting a low-carb diet.

## Email reports

**Settings → ✉ Email reports** creates an HTML report of last week and a cumulative overview (weight, macros, calorie balance, expected vs. actual, ketones, fasting, charts and tables).

- Enter your email address and, if you like, the date the cumulative part should start from.
- **Preview** shows the report; **Send now** sends it.
- On Android your email app opens with the address filled in and the report attached; tap Send. In the web version the report is downloaded and an email with a summary opens; attach the file yourself.
- Choose a **Reminder** day and time to get a weekly notification (Android).

## Health Connect (Android)

Porki reads **total and active calories, steps and weight** from Health Connect. It never writes anything to Health Connect.

1. Make sure the app on your watch or phone (Samsung Health, Google Fit, Fitbit, Garmin…) sends data to Health Connect: *Settings → Health Connect → App permissions*.
2. In Porki tap **Allow** and grant access.

Porki syncs the last 7 days every time you open it; **Sync** on the Today tab syncs the last 30 days. A manual entry for a day always takes priority over Health Connect. Weight is imported only for days without your own entry, and only if **Settings → Import weight from Health Connect** is on.

Health Connect needs Android 9 or newer. It is built into Android 14 and later; on older versions Porki offers to install it from the Play Store.

## Home screen widget (Android)

Long-press your home screen, choose **Widgets** and add **Porki**. The widget shows:

- the fast with a timer and progress (red while fasting, green while eating) and a button to start, end or log your first meal,
- weight and the change since the previous weigh-in,
- the expected weight change from your calorie balance (today and the last 7 days),
- net carbs and protein today,
- the latest ketone reading.

Tap the weight to enter today's weight, tap the carbs to add food, tap the ketones to open the Ketones tab.

## Backup and restore

Because your data is stored only on the device, make a backup regularly. Porki shows a reminder on the Today tab when you have not made a backup for more than 30 days.

- **Export:** *Settings → Export backup*. On Android the Share menu opens; choose Google Drive, Files or email. In the web version a file `porki-YYYY-MM-DD.json` is downloaded.
- **Restore:** *Settings → Import backup* and choose the file (also from Google Drive). Importing **replaces all current data**.

Make a backup before installing a new version of the app or moving to a new phone.

## Settings

Tap the gear icon at the top right.

- **Language** – English or Croatian.
- **Height** and **Goal weight**.
- **Diet** – opens *Diet and targets* to recalculate your targets.
- **Daily targets** – net carb limit, protein, fat and calories, if you want to set them by hand.
- **Carbs on labels include fibre** – for US product labels.
- **Health Connect** – status, permissions and weight import (Android).
- **Data** – email reports, export and import backup, and **Delete everything** (asks twice and cannot be undone).

## Questions and troubleshooting

**The app shows no calories burned.**
On Android, check that Health Connect has data from your watch or health app and that Porki has permission (*Settings → Health Connect → App permissions*), then tap **Sync**. In the web version enter calories yourself with **Manual** or **Past days**.

**A new version will not install over the old one.**
Make a backup first. The new APK must be signed with the same key as the installed one. If Android says the app conflicts with an existing one, do not uninstall until you have a backup, then report it.

**My data is different on the web and on the phone.**
They are separate. Export a backup on one and import it on the other.

**The online search or barcode lookup does not work.**
It needs an internet connection and the product must exist in Open Food Facts. You can always enter the values from the label manually.

**The ketone strip colours look different on screen.**
Screen colours are approximate; compare with the chart on the bottle.

**Where is the privacy policy?**
In the app it is shown when you grant Health Connect access. It is also in the repository: [English](www/privacy-en.html) · [Hrvatski](www/privacy.html).
