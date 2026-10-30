# LSS V2 Scripts

Userscripts von NilsPe und Weiterentwicklungen bestehender Scripts für das [Leitstellenspiel](https://www.leitstellenspiel.de/). Die Sammlung unterstützt beim Bauen, bei Personal und Ausbildung, der Fahrzeug- und Leitstellenverwaltung sowie bei Einsätzen, POIs und Verbandsauswertungen.

## Installation

1. Einen Userscript-Manager wie Tampermonkey im Browser einrichten.
2. Beim gewünschten Script auf **Installieren** klicken.
3. Die Installation im Userscript-Manager bestätigen und die passende Spielseite neu laden.

Installiere nur die Funktionen, die du verwenden möchtest. Die Scripts enthalten Update-Adressen für Aktualisierungen über den Userscript-Manager.

## Gemeinsame Funktionsweise

Die Scripts ergänzen je nach Funktion die Hauptseite, Gebäude- und Leitstellenansichten, Einsatzseiten, Schulen, POI-Verwaltung oder Topliste.

Viele Leitstellen-Werkzeuge öffnen ihre Einstellungen über das Zahnrad neben der jeweiligen Funktion. Andere Scripts haben eigene Einstellungen direkt auf der betreffenden Seite. Längere Abläufe zeigen ihren Fortschritt an; bei Werkzeugen mit einer Abbrechen-Schaltfläche kann der laufende Vorgang gestoppt werden.

Die Skriptbasis wird von den darauf aufbauenden Scripts über `@require` automatisch eingebunden. Eine zusätzliche Installation als eigenständiges Script ist dafür nicht erforderlich.

**Baumodus und Einsatzmodus sind alternative Betriebsarten. Aktiviere nur einen der beiden Modi gleichzeitig.**

## Leitstelle Assign Personal

**Datei:** [Leitstelle-Assign-Personal.user.js](Leitstelle-Assign-Personal.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Personal.user.js)

Prüft Fahrzeugbesatzungen und weist geeignetes Personal anhand gemeinsamer Sollwerte zu.

- Zielbesatzung je Fahrzeugtyp einstellen.
- Mit **Besatzung prüfen** den Ist-Zustand kontrollieren, ohne Personal umzusetzen.
- Mit **Personal zuweisen** die Besatzung anpassen; benötigte Ausbildungen werden berücksichtigt.
- Soll und Ist direkt in der Fahrzeugtabelle anzeigen; Unter- und Überbesetzung farblich hervorheben.
- Fahrzeuge mit mindestens der Zielbesatzung optional überspringen.

Die Besatzungsprüfung ist bereits in diesem Script enthalten.

## Leitstelle Assign Trailer

**Datei:** [Leitstelle-Assign-Trailer.user.js](Leitstelle-Assign-Trailer.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Trailer.user.js)

Prüft Anhänger und weist ihnen feste, konfigurierte Zugfahrzeuge derselben Wache zu. Die Fahrzeuge werden aus der Fahrzeugtabelle ermittelt.

- Passenden Zugfahrzeugtyp je unterstütztem Anhängertyp auswählen.
- Mit **Anhaenger pruefen** bestehende Zuweisungen kontrollieren und die Ergebnisse in der Tabelle anzeigen.
- Mit **Anhänger zuweisen** fehlende, falsche oder zufällige Zuweisungen korrigieren.
- Korrekte feste Zuweisungen beibehalten und verfügbare Zugfahrzeuge bei der Planung berücksichtigen.
- Nicht konfigurierte Anhängertypen überspringen.

Die Anhängerprüfung ist bereits in diesem Script enthalten.

## Leitstelle Autobuy Extensions

**Datei:** [Leitstelle-Autobuy-Extensions.user.js](Leitstelle-Autobuy-Extensions.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Extensions.user.js)

Kauft ausgewaehlte Erweiterungen fuer ein einzelnes Gebaeude oder fuer die
Gebaeude einer Leitstelle.
Die Erweiterungen werden nach Gebaeudetyp konfiguriert. Das Skript prueft,
welche Erweiterungen am jeweiligen Gebaeude verfuegbar und bereits vorhanden
sind. Anschliessend werden nur die noch fehlenden Erweiterungen gekauft.

## Leitstelle Autobuy Level

**Datei:** [Leitstelle-Autobuy-Level.user.js](Leitstelle-Autobuy-Level.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Level.user.js)

Kauft Gebaeudestufen fuer ein einzelnes Gebaeude oder fuer die Gebaeude einer
Leitstelle.
In den Einstellungen kann fuer jeden unterstuetzten Gebaeudetyp eine Zielstufe
festgelegt werden. Das Skript vergleicht die aktuelle Stufe mit der Zielstufe
und kauft die noch fehlenden Stufen nacheinander. Bereits ausreichend
ausgebaute Gebaeude werden uebersprungen.

## Leitstelle Autobuy Vehicles

**Datei:** [Leitstelle-Autobuy-Vehicles.user.js](Leitstelle-Autobuy-Vehicles.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Vehicles.user.js)

Kauft konfigurierte Fahrzeugmengen fuer ein einzelnes Gebaeude oder fuer die
Gebaeude einer Leitstelle.
Beim Start wird der Fahrzeug-Tab automatisch geladen. Das Skript zaehlt die
vorhandenen Fahrzeuge direkt in der Fahrzeugtabelle und ermittelt die noch
fehlende Anzahl je Fahrzeugtyp und Gebaeude. Die kaufbaren Fahrzeugtypen und
Kaufoptionen werden auf den Fahrzeug-Kaufseiten der jeweiligen Gebaeude
ermittelt.

## Leitstelle De-/Activate Buildings

**Datei:** [Leitstelle-Deactivate-Buildings.user.js](Leitstelle-Deactivate-Buildings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js)

Aktiviert oder deaktiviert ausgewaehlte Gebaeudetypen einer Leitstelle.
Das Skript liest den aktuellen Zustand der zugeordneten Gebaeude und schaltet
nur die Gebaeude um, die sich noch nicht im gewuenschten Zustand befinden.

## Leitstelle De-/Activate Extensions

**Datei:** [Leitstelle-Deactivate-Extensions.user.js](Leitstelle-Deactivate-Extensions.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Extensions.user.js)

Aktiviert oder deaktiviert konfigurierte Erweiterungen der Gebaeude einer
Leitstelle.
Die gewuenschten Erweiterungen werden nach Gebaeudetyp ausgewaehlt. Das Skript
prueft den aktuellen Zustand jeder Erweiterung und fuehrt nur notwendige
Umschaltungen aus.

## Leitstelle Delete Buildings

**Datei:** [Leitstelle-Delete-Buildings.user.js](Leitstelle-Delete-Buildings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Buildings.user.js)

Waehlt konfigurierte Gebaeudetypen einer Leitstelle aus und loescht die
ermittelten Gebaeude.
Ueber die Vorschau werden die betroffenen Gebaeude direkt in der
Gebaeudetabelle markiert. Fuer jeden Gebaeudetyp kann festgelegt werden, ab
welcher Position und in welchem Abstand Gebaeude ausgewaehlt werden.

## Leitstelle Delete Vehicles

**Datei:** [Leitstelle-Delete-Vehicles.user.js](Leitstelle-Delete-Vehicles.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Vehicles.user.js)

Waehlt konfigurierte Fahrzeugtypen aus der sichtbaren Fahrzeugtabelle aus und
loescht sie.
Die Loeschvorschau markiert die betroffenen Fahrzeuge in der Tabelle. Beim
Loeschen werden die ausgewaehlten Fahrzeuge mit der eingestellten Anzahl
paralleler Anfragen verarbeitet.

Zusätzlich lässt sich festlegen, wie viele Fahrzeuge je Typ und Wache erhalten bleiben und ob nur auf jeder n-ten Wache gelöscht werden soll.

## Leitstelle Fahrzeug Max-Personal

**Datei:** [Leitstelle-Vehicle-Max-Personal.user.js](Leitstelle-Vehicle-Max-Personal.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Vehicle-Max-Personal.user.js)

Setzt die maximale Besatzungsstaerke konfigurierter Fahrzeuge fuer ein
einzelnes Gebaeude oder fuer die Gebaeude einer Leitstelle.
Die Zielwerte werden nach Fahrzeugtyp festgelegt. Das Skript prueft die
sichtbare Fahrzeugtabelle und aendert nur Fahrzeuge, deren aktueller Wert vom
konfigurierten Maximum abweicht.

## Leitstelle Fahrzeugstatus 2/6

**Datei:** [Leitstelle-Fahrzeugstatus.user.js](Leitstelle-Fahrzeugstatus.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Fahrzeugstatus.user.js)

Setzt ausgewaehlte Fahrzeuge aus der sichtbaren Fahrzeugtabelle auf Status 2
oder Status 6.
Die zu bearbeitenden Fahrzeugtypen werden in den Einstellungen festgelegt.
Beim Setzen auf Status 6 kann je Fahrzeugtyp und Wache eine bestimmte Anzahl
von Fahrzeugen in Status 2 verbleiben.

## Leitstelle Move Buildings

**Datei:** [Leitstelle-Move-Buildings.user.js](Leitstelle-Move-Buildings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Move-Buildings.user.js)

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

## Leitstelle Quick Settings

**Datei:** [Leitstelle-Quick-Settings.user.js](Leitstelle-Quick-Settings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Quick-Settings.user.js)

Zeigt wichtige Leitstellen-Einstellungen direkt auf der Leitstellen-Hauptseite
und in der Gebaeudeliste an.
Die Einstellungen koennen dadurch schneller eingesehen und geaendert werden,
ohne jede Leitstelle einzeln ueber ihre Bearbeitungsseite aufrufen zu muessen.

## Leitstelle Rename Buildings

**Datei:** [Leitstelle-Rename-Buildings.user.js](Leitstelle-Rename-Buildings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Rename-Buildings.user.js)

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

**Datei:** [Leitstelle-Share-Buildings.user.js](Leitstelle-Share-Buildings.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Share-Buildings.user.js)

Gibt Krankenhausbetten und Polizeizellen im Verband frei und setzt die
zugehoerigen Gebuehren.

Optional kann eine zusätzliche Schaltfläche zum Zurücknehmen der Freigaben eingeblendet werden.

## Leitstelle Wachenpersonal

**Datei:** [Leitstelle-Wachenpersonal.user.js](Leitstelle-Wachenpersonal.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Wachenpersonal.user.js)

Setzt das Personal-Soll und die automatische Personalwerbung fuer die Gebaeude
einer Leitstelle.
Fuer jeden unterstuetzten Gebaeudetyp kann ein eigener Personal-Sollwert
eingestellt werden. Nach einem Klick auf `Personal setzen` uebernimmt das
Skript die Werte fuer alle passenden Gebaeude der geoeffneten Leitstelle und
stellt die Personalwerbung auf automatisch.

## Leitstelle-Bepo-Werber

**Datei:** [Leitstelle-Bepo-Werber.user.js](Leitstelle-Bepo-Werber.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Bepo-Werber.user.js)

Verteilt unausgebildetes Personal aus Polizei- und Bereitschaftspolizeiwachen
auf ausgewaehlte BePo-Zielwachen.
Das Skript fuellt die Zielwachen bis zum eingestellten Personalwert auf. Fuer
Quellwachen koennen Mindestpersonalwerte festgelegt werden. Einzelne Quell- und
Zielwachen sowie komplette Leitstellen lassen sich ein- oder ausschliessen.

## Leitstelle-Pol-Werber

**Datei:** [Leitstelle-Pol-Werber.user.js](Leitstelle-Pol-Werber.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Pol-Werber.user.js)

Verteilt unausgebildetes Personal aus Polizei- und Bereitschaftspolizeiwachen
auf ausgewaehlte Polizeiwachen.
Das Skript fuellt Polizeiwachen bis zum eingestellten Personalwert auf. Fuer
Quellwachen koennen Mindestpersonalwerte festgelegt werden. Einzelne Quell- und
Zielwachen sowie komplette Leitstellen lassen sich ein- oder ausschliessen.

## LSS A Baumodus

**Datei:** [LSS-A-Baumodus.user.js](LSS-A-Baumodus.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Baumodus.user.js)

Reduziert auf der Hauptseite Einsatzliste und Missionsaktualisierungen, damit
groessere Bauvorgaenge fluessiger laufen. Der Baumeister und die
Gebaeudedaten bleiben dabei nutzbar.
Der Baumodus und der Einsatzmodus sind alternative Betriebsarten und sollten
nicht gleichzeitig aktiviert werden.

## LSS A Einsatzmodus

**Datei:** [LSS-A-Einsatzmodus.user.js](LSS-A-Einsatzmodus.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Einsatzmodus.user.js)

Blendet auf der Hauptseite nur die Gebaeudeliste aus. Karte, Gebaeude und
Einsatzlisten bleiben aktiv.
Der Einsatzmodus und der Baumodus sind alternative Betriebsarten und sollten
nicht gleichzeitig aktiviert werden.

## LSS Baumeister 2.0

**Datei:** [LSS-Baumeister-2.user.js](LSS-Baumeister-2.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Baumeister-2.user.js)

Merkt Baupositionen auf der Karte vor und baut die geplanten Gebäude anschließend nacheinander.

- Einzelne Standorte am aktuellen Baumarker vormerken.
- Rechteckraster mit bis zu 30 Zeilen und 30 Spalten erstellen; die Ausrichtung erfolgt nach Süden und Osten.
- Gefüllte Kreisraster mit 1 bis 10.000 Baupositionen um den Marker erstellen.
- Rasterabstände von 100 m, 250 m, 500 m, 1 km, 2 km oder 5 km auswählen.
- Gebäudekombinationen je Standort verwenden.
- Namen mit Suffix, Startnummer und gewünschter Stellenzahl vergeben.
- Eine Leitstelle fest auswählen oder die jeweils nächstgelegene Leitstelle zuordnen lassen.
- Geplante Positionen als farbige Marker anzeigen und zurücksetzen.

**Tastenkürzel:** `V` merkt den aktuellen Standort vor, `S` startet den Bau.

## LSS Freigabenzaehler NilsPe

**Datei:** [LSS-Own-Alliance-Mission-Count.user.js](LSS-Own-Alliance-Mission-Count.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Own-Alliance-Mission-Count.user.js)

Zeigt konfigurierbare Zaehler und Credit-Summen oberhalb der Einsatzliste.
Enthalten sind unter anderem eigene Freigaben sowie angefahrene und offene
Verbandseinsaetze. Basiert auf dem MIT-lizenzierten Skript von Jan (jxn_30).

## LSS Gebaeude Personnel Selector

**Datei:** [LSS-Gebaeude-Personnel-Selector.user.js](LSS-Gebaeude-Personnel-Selector.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Personnel-Selector.user.js)

Erweitert die Personaluebernahme zwischen Gebaeuden um eine schnelle Auswahl
bestimmter Personalmengen.
Fuer die angezeigten Quellwachen stehen Schaltflaechen zur Auswahl bestimmter
Personalmengen zur Verfuegung. Das Personal kann nach Ausbildung gefiltert
werden. Dabei wird nur ungebundenes Personal ausgewaehlt.
Die aktuelle Auswahl wird angezeigt und kann ueber die Zuruecksetzen-
Schaltflaeche wieder aufgehoben werden.

## LSS Gebäude Reload-Blocker

**Datei:** [LSS-Gebaeude-Reload-Blocker.user.js](LSS-Gebaeude-Reload-Blocker.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Reload-Blocker.user.js)

Unterbindet automatische Seiten-Reloads durch bestimmte abgelaufene Timer in Gebäude- und Leitstellenansichten. Berücksichtigt werden Einsatz-Countdowns, Gefangenentransporte, Gebäudekomplex-Timer und Fahrzeugumbauten. Die Timer-Anzeigen laufen weiter; der anschließende automatische Reload entfällt.

Das Script arbeitet ohne zusätzliche Bedienoberfläche. Bei Bedarf kann die Seite manuell aktualisiert werden.

## LSS Heli Auswahl

**Datei:** [LSS-Heli-Auswahl.user.js](LSS-Heli-Auswahl.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Heli-Auswahl.user.js)

Waehlt bei der AAO-Auswahl die naechsten passenden Helikopter und begrenzt
deren Anflugzeit. Die maximale Anflugzeit kann direkt auf der Einsatzseite
eingestellt werden.

## LSS Lehrgangsmeister

**Datei:** [LSS-Lehrgangsmeister.user.js](LSS-Lehrgangsmeister.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Lehrgangsmeister.user.js)

Vereinfacht das Erstellen und Befüllen vieler Lehrgänge für größere Personalmengen.

- Gewünschte Lehrgänge und benötigte Räume auswählen.
- Die Auswahl auf bestimmte Schulen begrenzen und freie Klassenräume berücksichtigen.
- Die Zahl der zu ladenden Räume begrenzen.
- Wachen über eine Stichwortsuche eingrenzen und Personal mit Ausbildungsprüfung auswählen.
- Fortschritt beim Laden und Befüllen der Schulen anzeigen.

Schul- und Gebäudedaten werden über den gemeinsamen API-Cache geladen. Unabhängige Raumaktionen laufen mit begrenzter Parallelität.

## LSS POI-Multitool

**Datei:** [LSS-POI-Multitool.user.js](LSS-POI-Multitool.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-POI-Multitool.user.js)

Merkt einzelne POIs oder selbst zusammengestellte POI-Pakete auf der Karte vor und setzt sie anschließend gesammelt.

- **Einzelmodus:** einen ausgewählten POI je Standort vormerken.
- **Paketmodus:** alle ausgewählten POI-Typen an jedem Standort vormerken.
- **Rechteckraster:** bis zu 30 × 30 Standorte ab dem Kartenmarker nach Süden und Osten.
- **Kreisraster:** ein gefülltes Raster mit 1 bis 10.000 Standorten um den Kartenmarker.
- **Abstand:** frei einstellbar von 25 bis 100.000 Metern; Rasterwerte werden gespeichert.
- Farbige Vormerk-Marker und eine Übersicht der vorgemerkten POIs je Typ anzeigen.
- Die Warteschlange auf Wunsch über einen Seiten-Reload hinweg erhalten.
- Bis zu 50.000 POIs insgesamt vormerken; bei Paketen zählt jeder POI-Typ einzeln.
- Geladene beziehungsweise gefilterte POIs über die Verwaltungsfunktion gesammelt löschen.

**Bedienung:** POI-Auswahl in den Einstellungen festlegen, Kartenmarker positionieren, einzelne Standorte oder Raster vormerken und anschließend **Alle speichern** wählen. Ein Kreisraster mit 144 Standorten und drei ausgewählten POI-Typen ergibt beispielsweise 432 POIs.

Beim Setzen werden keine zusätzlichen Redirect-Seiten pro POI geladen. Nach dem vollständigen Durchlauf werden Warteschlange und Vormerk-Marker geleert und die Seite einmal aktualisiert. Es gibt kein Abschluss-Pop-up. Wird die Verarbeitung unterbrochen, erscheint ein Hinweis im Werkzeug.

**Tastenkürzel:** `V` vormerken, `S` speichern, `R` zurücksetzen.

## LSS Toplist Check

**Datei:** [LSS-Toplist-Check.user.js](LSS-Toplist-Check.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Check.user.js)

Prüft alle Mitglieder eines Verbandes gegen die ersten 100 Seiten der LSS-Toplist, also die Top 2.000.

Dabei werden sämtliche Mitgliederseiten des Verbandes berücksichtigt. Das Script unterscheidet zwischen gefundenen Spielern, auffälligen Spielern innerhalb der anhand der Credits bestimmten Prüfgrenze und Spielern außerhalb dieses Bereichs. Auffällige Mitglieder können gesondert angezeigt werden. Die Toplist-Daten werden bis zu zwölf Stunden zwischengespeichert und lassen sich über die Aktualisierungsfunktion neu laden.

## LSS Toplist Distance

**Datei:** [LSS-Toplist-Distance.user.js](LSS-Toplist-Distance.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Distance.user.js)

Zeigt Credit-Abstaende in der Topliste und speichert einen begrenzten Verlauf
fuer das Diagramm. Basiert auf einem MIT-lizenzierten Skript von Jan (jxn_30).

## LSS Wachen/Fhz Navigation Hotkeys

**Datei:** [LSS-Wachen-Fhz-Navigation-Hotkeys.user.js](LSS-Wachen-Fhz-Navigation-Hotkeys.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Wachen-Fhz-Navigation-Hotkeys.user.js)

Ergaenzt die Navigation auf Gebaeude- und Fahrzeugseiten um Hotkeys. Die
Tasten `A` und `D` beziehungsweise die Pfeiltasten wechseln zum vorherigen
oder naechsten Eintrag. Auf Gebaeudeseiten oeffnet `W` den mittleren Link und
`S` den Fahrzeugkauf. In Eingabefeldern und im geoeffneten Baumeister sind
die Hotkeys deaktiviert.

## NilsPe LSS Core

**Datei:** [NilsPe-Skriptbasis.user.js](NilsPe-Skriptbasis.user.js) · [Installieren](https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js)

Gemeinsame Grundlage für die darauf aufbauenden Userscripts; sie wird von diesen automatisch über `@require` eingebunden.

- Lädt Gebäude, Verbandsgebäude, Fahrzeuge und POIs über die v2-API.
- Stellt zusätzliche Daten zu Einsätzen, Lehrgängen, Benutzern und Verbänden bereit.
- Lädt Typinformationen für Gebäude, Fahrzeuge und Ausbildungen.
- Speichert API-Daten lokal in einer nach Spielkonto getrennten IndexedDB.
- Aktualisiert v2-Daten inkrementell und verarbeitet große Datenbestände seitenweise.
- Stellt gemeinsame Einstellungsfelder sowie Hilfsfunktionen für begrenzt parallele Abläufe bereit.

## Rückmeldungen

Fehler und Verbesserungsvorschläge können über die [GitHub Issues](https://github.com/NilsPee/LSS_V2_Scripts/issues) gemeldet werden. Hilfreich sind Scriptname, Version, betroffene Spielseite und die Schritte, mit denen sich das Verhalten nachvollziehen lässt.

## Autoren und Lizenzen

Autorennamen und Lizenzangaben stehen im Kopf des jeweiligen Userscripts. Teile der Sammlung bauen auf Arbeiten anderer Autoren auf; die dort enthaltenen Hinweise und Lizenztexte sind zu beachten.
