# LSS V2 Scripts

Userscripts von NilsPe fuer das Leitstellenspiel.

## Gemeinsame Funktionsweise

Die Skripte erweitern die Gebaeude- und Leitstellenseiten um zusaetzliche
Schaltflaechen. Ueber das Zahnrad neben einer Funktion werden die zugehoerigen
Einstellungen geoeffnet.

Bei laengeren Ablaeufen zeigen die Skripte den aktuellen Fortschritt an. Ein
laufender Vorgang kann ueber die Schaltflaeche `Abbrechen` beendet werden.

## NilsPe LSS Core

**Datei:** `NilsPe-Skriptbasis.user.js`

Die Skriptbasis stellt gemeinsam genutzte Funktionen fuer die weiteren
Userscripts bereit.

- Laedt Gebaeude, Verbandsgebaeude, Fahrzeuge und POIs ueber die v2-API.
- Speichert API-Daten lokal in einer IndexedDB.
- Aktualisiert vorhandene Daten inkrementell anhand des letzten
  Aktualisierungszeitpunkts.
- Laedt grosse Datenmengen seitenweise ueber die API-Paginierung.
- Stellt den gemeinsamen Einstellungsbereich fuer die einzelnen Skripte bereit.

## Leitstelle Autobuy Level

**Datei:** `Leitstelle-Autobuy-Level.user.js`

Kauft Gebaeudestufen fuer ein einzelnes Gebaeude oder fuer die Gebaeude einer
Leitstelle.

In den Einstellungen kann fuer jeden unterstuetzten Gebaeudetyp eine Zielstufe
festgelegt werden. Das Skript vergleicht die aktuelle Stufe mit der Zielstufe
und kauft die noch fehlenden Stufen nacheinander. Bereits ausreichend
ausgebaute Gebaeude werden uebersprungen.

## Leitstelle Autobuy Extensions

**Datei:** `Leitstelle-Autobuy-Extensions.user.js`

Kauft ausgewaehlte Erweiterungen fuer ein einzelnes Gebaeude oder fuer die
Gebaeude einer Leitstelle.

Die Erweiterungen werden nach Gebaeudetyp konfiguriert. Das Skript prueft,
welche Erweiterungen am jeweiligen Gebaeude verfuegbar und bereits vorhanden
sind. Anschliessend werden nur die noch fehlenden Erweiterungen gekauft.

## Leitstelle Autobuy Vehicles

**Datei:** `Leitstelle-Autobuy-Vehicles.user.js`

Kauft konfigurierte Fahrzeugmengen fuer ein einzelnes Gebaeude oder fuer die
Gebaeude einer Leitstelle.

Beim Start wird der Fahrzeug-Tab automatisch geladen. Das Skript zaehlt die
vorhandenen Fahrzeuge direkt in der Fahrzeugtabelle und ermittelt die noch
fehlende Anzahl je Fahrzeugtyp und Gebaeude. Die kaufbaren Fahrzeugtypen und
Kaufoptionen werden auf den Fahrzeug-Kaufseiten der jeweiligen Gebaeude
ermittelt.

## Leitstelle-Bepo-Werber

**Datei:** `Leitstelle-Bepo-Werber.user.js`

Verteilt unausgebildetes Personal aus Polizei- und Bereitschaftspolizeiwachen
auf ausgewaehlte BePo-Zielwachen.

Das Skript fuellt die Zielwachen bis zum eingestellten Personalwert auf. Fuer
Quellwachen koennen Mindestpersonalwerte festgelegt werden. Einzelne Quell- und
Zielwachen sowie komplette Leitstellen lassen sich ein- oder ausschliessen.


## Leitstelle-Pol-Werber

**Datei:** `Leitstelle-Pol-Werber.user.js`

Verteilt unausgebildetes Personal aus Polizei- und Bereitschaftspolizeiwachen
auf ausgewaehlte Polizeiwachen.

Das Skript fuellt Polizeiwachen bis zum eingestellten Personalwert auf. Fuer
Quellwachen koennen Mindestpersonalwerte festgelegt werden. Einzelne Quell- und
Zielwachen sowie komplette Leitstellen lassen sich ein- oder ausschliessen.

## Leitstelle Assign Personal

**Datei:** `Leitstelle-Assign-Personal.user.js`

Weist den Fahrzeugen eines geoeffneten Gebaeudes automatisch Personal zu.

Fuer jeden Fahrzeugtyp kann eine Zielbesatzung eingestellt werden. Das Skript
prueft die benoetigte Ausbildung und weist nur geeignetes Personal zu.
Fahrzeuge, die bereits mindestens die Zielbesatzung besitzen, koennen
uebersprungen werden.

## Leitstelle Besatzungs-Checker

**Datei:** `Leitstelle-Besatzungs-Checker.user.js`

Prueft die Fahrzeuge eines geoeffneten Gebaeudes auf ihre konfigurierte
Soll-Besatzung.

Das Skript vergleicht die aktuelle Besatzung mit den Zielwerten aus
`Leitstelle Assign Personal`. Dabei wird ebenfalls geprueft, ob das zugewiesene
Personal die fuer das Fahrzeug benoetigte Ausbildung besitzt. Abweichungen
werden direkt in der Fahrzeugtabelle hervorgehoben.

## Leitstelle De-/Activate Buildings

**Datei:** `Leitstelle-Deactivate-Buildings.user.js`

Aktiviert oder deaktiviert ausgewaehlte Gebaeudetypen einer Leitstelle.

Das Skript liest den aktuellen Zustand der zugeordneten Gebaeude und schaltet
nur die Gebaeude um, die sich noch nicht im gewuenschten Zustand befinden.

## Leitstelle De-/Activate Extensions

**Datei:** `Leitstelle-Deactivate-Extensions.user.js`

Aktiviert oder deaktiviert konfigurierte Erweiterungen der Gebaeude einer
Leitstelle.

Die gewuenschten Erweiterungen werden nach Gebaeudetyp ausgewaehlt. Das Skript
prueft den aktuellen Zustand jeder Erweiterung und fuehrt nur notwendige
Umschaltungen aus.

## Leitstelle Delete Buildings

**Datei:** `Leitstelle-Delete-Buildings.user.js`

Waehlt konfigurierte Gebaeudetypen einer Leitstelle aus und loescht die
ermittelten Gebaeude.

Ueber die Vorschau werden die betroffenen Gebaeude direkt in der
Gebaeudetabelle markiert. Fuer jeden Gebaeudetyp kann festgelegt werden, ab
welcher Position und in welchem Abstand Gebaeude ausgewaehlt werden.

## Leitstelle Delete Vehicles

**Datei:** `Leitstelle-Delete-Vehicles.user.js`

Waehlt konfigurierte Fahrzeugtypen aus der sichtbaren Fahrzeugtabelle aus und
loescht sie.

Die Loeschvorschau markiert die betroffenen Fahrzeuge in der Tabelle. Beim
Loeschen werden die ausgewaehlten Fahrzeuge mit der eingestellten Anzahl
paralleler Anfragen verarbeitet.

## Leitstelle Fahrzeugstatus 2/6

**Datei:** `Leitstelle-Fahrzeugstatus.user.js`

Setzt ausgewaehlte Fahrzeuge aus der sichtbaren Fahrzeugtabelle auf Status 2
oder Status 6.

Die zu bearbeitenden Fahrzeugtypen werden in den Einstellungen festgelegt.
Beim Setzen auf Status 6 kann je Fahrzeugtyp und Wache eine bestimmte Anzahl
von Fahrzeugen in Status 2 verbleiben.


## Leitstelle Fahrzeug Max-Personal

**Datei:** `Leitstelle-Vehicle-Max-Personal.user.js`

Setzt die maximale Besatzungsstaerke konfigurierter Fahrzeuge fuer ein
einzelnes Gebaeude oder fuer die Gebaeude einer Leitstelle.

Die Zielwerte werden nach Fahrzeugtyp festgelegt. Das Skript prueft die
sichtbare Fahrzeugtabelle und aendert nur Fahrzeuge, deren aktueller Wert vom
konfigurierten Maximum abweicht.

## Leitstelle Wachenpersonal

**Datei:** `Leitstelle-Wachenpersonal.user.js`

Setzt das Personal-Soll und die automatische Personalwerbung fuer die Gebaeude
einer Leitstelle.

Fuer jeden unterstuetzten Gebaeudetyp kann ein eigener Personal-Sollwert
eingestellt werden. Nach einem Klick auf `Personal setzen` uebernimmt das
Skript die Werte fuer alle passenden Gebaeude der geoeffneten Leitstelle und
stellt die Personalwerbung auf automatisch.
