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

## Leitstelle Assign Trailer

**Datei:** `Leitstelle-Assign-Trailer.user.js`

Weist Anhaenger im Fahrzeug-Tab einer Leitstelle automatisch passenden
Zugfahrzeugen derselben Wache zu.

Fuer unterstuetzte Anhaengertypen aus Feuerwehr, SEG, Bereitschaftspolizei und
THW kann jeweils ein zulaessiger Zugfahrzeugtyp ausgewaehlt werden. Ist fuer
einen Anhaengertyp kein Zugfahrzeug ausgewaehlt, wird dieser Typ uebersprungen.

Die Fahrzeuge werden direkt aus der sichtbaren Fahrzeugtabelle ermittelt.
Vor einer neuen Zuweisung prueft das Skript die Bearbeitungsseite des
jeweiligen Anhaengers. Bereits fest zugewiesene Anhaenger werden uebersprungen,
damit vorhandene Gespanne nicht veraendert werden.

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

## Leitstelle Move Buildings

**Datei:** `Leitstelle-Move-Buildings.user.js`

Verschiebt ausgewaehlte Wachen einer Leitstelle gesammelt in eine andere
Leitstelle.

In den Einstellungen werden die Ziel-Leitstelle und ein Namensfilter
festgelegt. Es werden nur Wachen der aktuell geoeffneten Leitstelle
verschoben, deren Name den angegebenen Text enthaelt.

Vor dem Verschieben kann eine Bestaetigung mit einer Vorschau der gefundenen
Wachen angezeigt werden. Zusaetzlich steht ein Testlauf zur Verfuegung, bei
dem die Auswahl geprueft wird, ohne die Wachen tatsaechlich zu verschieben.

Die Verschiebungen koennen mit konfigurierbarer Parallelitaet und Pause
zwischen den Anfragen ausgefuehrt werden.

## Leitstelle Rename Buildings

**Datei:** `Leitstelle-Rename-Buildings.user.js`

Benennt die Gebaeude einer Leitstelle nach einem einheitlichen Schema um.

Fuer jeden unterstuetzten Gebaeudetyp kann eine eigene Bezeichnung festgelegt
werden. Zusaetzlich wird ein Namens-Suffix, beispielsweise ein Gebiets- oder
Stadtname, festgelegt. Die Gebaeude werden aufsteigend nach ihrer Gebaeude-ID
nummeriert.

Das Namensschema lautet:

`Wachentyp Namens-Suffix Nummer`

Beispiel:

`Bepol Berlin 001`

Fuer die Nummerierung kann festgelegt werden, ob beispielsweise mit `0`, `00`
oder `000` aufgefuellt werden soll.

## Leitstelle Share Buildings

**Datei:** `Leitstelle-Share-Buildings.user.js`

Gibt ausgewaehlte Gebaeude einer Leitstelle fuer den Verband frei oder nimmt
bestehende Freigaben wieder zurueck.

Die zu bearbeitenden Gebaeudetypen werden in den Einstellungen festgelegt.
Ueber die Leitstelle koennen dadurch viele passende Gebaeude gesammelt
freigegeben werden. Optional steht eine Schaltflaeche zum Zuruecknehmen der
Freigaben zur Verfuegung.

## Leitstelle Wachenpersonal

**Datei:** `Leitstelle-Wachenpersonal.user.js`

Setzt das Personal-Soll und die automatische Personalwerbung fuer die Gebaeude
einer Leitstelle.

Fuer jeden unterstuetzten Gebaeudetyp kann ein eigener Personal-Sollwert
eingestellt werden. Nach einem Klick auf `Personal setzen` uebernimmt das
Skript die Werte fuer alle passenden Gebaeude der geoeffneten Leitstelle und
stellt die Personalwerbung auf automatisch.

## Baumeister 2.0

**Datei:** `Baumeister-2.user.js`

Merkt einzelne Baupositionen oder komplette Raster auf der Karte vor und baut
die geplanten Gebaeude kontrolliert nacheinander. Namen, Nummerierung,
Gebaeudekombinationen und Leitstellenzuordnung lassen sich vor dem Start
festlegen.

## Lehrgangsmeister

**Datei:** `Lehrgangsmeister.user.js`

Vereinfacht das Erstellen und Befuellen vieler Lehrgaenge. Schul- und
Gebaeudedaten werden ueber den gemeinsamen API-Cache geladen; unabhaengige
Raumaktionen laufen mit begrenzter Parallelitaet.

## Personnel Selector

**Datei:** `Personnel-Selector.user.js`

Erweitert die Personaluebernahme zwischen Gebaeuden um eine schnelle Auswahl
bestimmter Personalmengen.

Fuer die angezeigten Quellwachen stehen Schaltflaechen zur Auswahl bestimmter
Personalmengen zur Verfuegung. Das Personal kann nach Ausbildung gefiltert
werden. Dabei wird nur ungebundenes Personal ausgewaehlt.

Die aktuelle Auswahl wird angezeigt und kann ueber die Zuruecksetzen-
Schaltflaeche wieder aufgehoben werden.

## LSS Freigabenzaehler

**Datei:** `LSS-Own-Alliance-Mission-Count.user.js`

Zeigt konfigurierbare Zaehler und Credit-Summen oberhalb der Einsatzliste.
Enthalten sind unter anderem eigene Freigaben sowie angefahrene und offene
Verbandseinsaetze. Basiert auf dem MIT-lizenzierten Skript von Jan (jxn_30).

## LSS A Baumodus

**Datei:** `LSS-A-Baumodus.user.js`

Reduziert auf der Hauptseite Einsatzliste und Missionsaktualisierungen, damit
groessere Bauvorgaenge fluessiger laufen. Der Baumeister und die
Gebaeudedaten bleiben dabei nutzbar.

Der Baumodus und der Einsatzmodus sind alternative Betriebsarten und sollten
nicht gleichzeitig aktiviert werden.

## LSS A Einsatzmodus

**Datei:** `LSS-A-Einsatzmodus.user.js`

Blendet auf der Hauptseite nur die Gebaeudeliste aus. Karte, Gebaeude und
Einsatzlisten bleiben aktiv.

Der Einsatzmodus und der Baumodus sind alternative Betriebsarten und sollten
nicht gleichzeitig aktiviert werden.

## LSS Toplist Distance

**Datei:** `LSS-Toplist-Distance.user.js`

Zeigt Credit-Abstaende in der Topliste und speichert einen begrenzten Verlauf
fuer das Diagramm. Basiert auf einem MIT-lizenzierten Skript von Jan (jxn_30).

## Wachen/Fhz Navigation Hotkeys

**Datei:** `Wachen-Fhz-Navigation-Hotkeys.user.js`

Ergaenzt die Navigation auf Gebaeude- und Fahrzeugseiten um Hotkeys. Die
Tasten `A` und `D` beziehungsweise die Pfeiltasten wechseln zum vorherigen
oder naechsten Eintrag. Auf Gebaeudeseiten oeffnet `W` den mittleren Link und
`S` den Fahrzeugkauf. In Eingabefeldern und im geoeffneten Baumeister sind
die Hotkeys deaktiviert.
