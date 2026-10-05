LSS V2 Scripts
Userscripts von NilsPe für das Leitstellenspiel.
Gemeinsame Funktionsweise
Die Skripte erweitern verschiedene Seiten des Leitstellenspiels um zusätzliche Funktionen, Schaltflächen und Automatisierungen. Viele Skripte verwenden die gemeinsame Skriptbasis NilsPe-Skriptbasis.user.js für API-Zugriffe, Caching und Einstellungen.
Bei längeren Abläufen zeigen die Skripte den aktuellen Fortschritt an. Laufende Vorgänge können je nach Skript über Abbrechen beendet werden.
Skripte
Leitstelle Assign Personal
Datei: Leitstelle-Assign-Personal.user.js
Weist den Fahrzeugen eines geöffneten Gebäudes automatisch die konfigurierte Besatzung zu. Für jeden Fahrzeugtyp kann eine Zielbesatzung eingestellt werden; benötigte Ausbildungen werden berücksichtigt.
Leitstelle Assign Trailer
Datei: Leitstelle-Assign-Trailer.user.js
Weist Anhänger festen, konfigurierten Zugfahrzeugen derselben Wache zu. Falsche oder zufällige Zuweisungen können korrigiert werden; je Anhängertyp lässt sich der gewünschte Zugfahrzeugtyp festlegen.
Leitstelle Autobuy Extensions
Datei: Leitstelle-Autobuy-Extensions.user.js
Kauft konfigurierte Erweiterungen für einzelne Gebäude oder alle passenden Gebäude einer Leitstelle. Bereits vorhandene Erweiterungen werden erkannt und übersprungen.
Leitstelle Autobuy Level
Datei: Leitstelle-Autobuy-Level.user.js
Kauft fehlende Gebäudestufen bis zu einer konfigurierten Zielstufe. Das Skript kann auf einem einzelnen Gebäude oder gesammelt über eine Leitstelle arbeiten.
Leitstelle Autobuy Vehicles
Datei: Leitstelle-Autobuy-Vehicles.user.js
Kauft konfigurierte Fahrzeugmengen für einzelne Gebäude oder eine Leitstelle. Vorhandene Fahrzeuge werden gezählt und nur die noch fehlenden Fahrzeuge gekauft.
Leitstelle-Bepo-Werber
Datei: Leitstelle-Bepo-Werber.user.js
Verteilt unausgebildetes Personal aus Polizei- und Bereitschaftspolizeiwachen auf ausgewählte BePo-Zielwachen. Quell- und Zielwachen sowie komplette Leitstellen können gefiltert werden.
Leitstelle Besatzungs-Checker
Datei: Leitstelle-Besatzungs-Checker.user.js
Prüft sichtbare Fahrzeuge auf Soll- und Ist-Besatzung und berücksichtigt dabei die benötigte Ausbildung. Abweichungen werden direkt in der Fahrzeugtabelle hervorgehoben.
Leitstelle De-/Activate Buildings
Datei: Leitstelle-Deactivate-Buildings.user.js
Aktiviert oder deaktiviert konfigurierte Gebäude einer Leitstelle und ändert nur Einträge, deren aktueller Zustand vom gewünschten Zustand abweicht.
Leitstelle De-/Activate Extensions
Datei: Leitstelle-Deactivate-Extensions.user.js
Aktiviert oder deaktiviert konfigurierte Erweiterungen einer Leitstelle und führt nur notwendige Umschaltungen aus.
Leitstelle Delete Buildings
Datei: Leitstelle-Delete-Buildings.user.js
Markiert und löscht konfigurierte Gebäude einer Leitstelle. Eine Vorschau zeigt vorab, welche Gebäude betroffen sind.
Leitstelle Delete Vehicles
Datei: Leitstelle-Delete-Vehicles.user.js
Markiert und löscht ausgewählte Fahrzeugtypen aus der sichtbaren Fahrzeugtabelle. Die Verarbeitung kann mit mehreren parallelen Anfragen erfolgen.
Leitstelle Fahrzeug Max-Personal
Datei: Leitstelle-Vehicle-Max-Personal.user.js
Setzt die maximale Personenanzahl konfigurierter Fahrzeuge für einzelne Gebäude oder eine Leitstelle. Nur abweichende Fahrzeuge werden geändert.
Leitstelle Fahrzeugstatus 2/6
Datei: Leitstelle-Fahrzeugstatus.user.js
Setzt sichtbare konfigurierte Fahrzeuge auf Status 6 oder wieder auf Status 2. Für Status 6 kann je Fahrzeugtyp und Wache eine Restanzahl in Status 2 definiert werden.
Leitstelle Move Buildings
Datei: Leitstelle-Move-Buildings.user.js
Verschiebt Wachen einer Leitstelle anhand eines Namensfilters in eine andere Leitstelle. Vorschau, Testlauf, Parallelität und Pausen zwischen Anfragen sind konfigurierbar.
Leitstelle-Pol-Werber
Datei: Leitstelle-Pol-Werber.user.js
Verteilt unausgebildetes Personal aus Polizei- und BePo-Wachen auf Polizeiwachen. Quell- und Zielwachen sowie komplette Leitstellen können gefiltert werden.
Leitstelle Quick Settings
Datei: Leitstelle-Quick-Settings.user.js
Zeigt wichtige Leitstellen-Einstellungen direkt auf der Leitstellen-Hauptseite und in der Gebäudeliste an, ohne jede Leitstelle einzeln bearbeiten zu müssen.
Leitstelle Rename Buildings
Datei: Leitstelle-Rename-Buildings.user.js
Benennt Gebäude einer Leitstelle nach Typ, Namens-Suffix und fortlaufender Nummer um. Das Nummernformat kann konfiguriert werden.
Leitstelle Share Buildings
Datei: Leitstelle-Share-Buildings.user.js
Gibt Krankenhausbetten und Polizeizellen im Verband frei und setzt die zugehörigen Gebühren.
Leitstelle Trailer-Checker
Datei: Leitstelle-Trailer-Checker.user.js
Prüft Anhänger-Zuweisungen und erkennt fehlende, falsche, zufällige und mehrfache Zugfahrzeug-Zuweisungen.
Leitstelle Wachenpersonal
Datei: Leitstelle-Wachenpersonal.user.js
Setzt Personal-Soll und automatische Personalwerbung für konfigurierte Wachen einer Leitstelle.
LSS A Baumodus
Datei: LSS-A-Baumodus.user.js
Reduziert Einsatzliste und Missionsaktualisierungen auf der Hauptseite, damit größere Bauvorgänge flüssiger laufen. Der Baumeister und die Gebäudedaten bleiben nutzbar.
LSS A Einsatzmodus
Datei: LSS-A-Einsatzmodus.user.js
Blendet die Gebäudeliste auf der Hauptseite aus, während Karte und Einsatzlisten aktiv bleiben. Baumodus und Einsatzmodus sind alternative Betriebsarten.
LSS Baumeister 2.0
Datei: LSS-Baumeister-2.user.js
Merkt einzelne Baupositionen oder komplette Raster auf der Karte vor und baut die geplanten Gebäude kontrolliert nacheinander. Namen, Nummerierung, Gebäudekombinationen und Leitstellenzuordnung sind konfigurierbar.
LSS Freigabenzaehler NilsPe
Datei: LSS-Own-Alliance-Mission-Count.user.js
Zeigt konfigurierbare Zähler oberhalb der Einsatzliste, darunter eigene Freigaben sowie angefahrene und offene Verbandseinsätze. Basiert auf einem MIT-lizenzierten Skript von Jan (jxn_30).
LSS Gebaeude Personnel Selector
Datei: LSS-Gebaeude-Personnel-Selector.user.js
Erweitert die Personalübernahme zwischen Gebäuden um eine schnelle Auswahl bestimmter Personalmengen. Lehrgangsfilter und die Auswahl ausschließlich ungebundenen Personals werden unterstützt.
LSS Heli Auswahl
Datei: LSS-Heli-Auswahl.user.js
Wählt bei der AAO-Auswahl die nächsten passenden Helikopter und begrenzt deren Anflugzeit. Die maximale Anflugzeit kann direkt auf der Einsatzseite eingestellt werden.
LSS Lehrgangsmeister
Datei: LSS-Lehrgangsmeister.user.js
Reduziert die notwendigen Klicks beim Ausbilden großer Personalmengen. Schul- und Gebäudedaten werden über den gemeinsamen API-Cache geladen.
LSS POI-Multitool
Datei: LSS-POI-Multitool.user.js
Ermöglicht es, einzelne POIs oder konfigurierbare POI-Pakete auf der Karte vorzumerken, gesammelt zu speichern und zu verwalten. Zusätzlich können gefilterte POIs gesammelt gelöscht werden.
LSS Toplist Check
Datei: LSS-Toplist-Check.user.js
Prüft alle Mitglieder eines Verbandes gegen die ersten 500 Seiten der LSS-Toplist (Top 10.000). Mitglieder aller Verbandsseiten werden berücksichtigt; nicht in der geprüften Toplist gefundene Spieler können gezielt gefiltert werden.
LSS Toplist Distance
Datei: LSS-Toplist-Distance.user.js
Zeigt Credit-Abstände in der Topliste und speichert einen begrenzten Verlauf für das Diagramm. Basiert auf einem MIT-lizenzierten Skript von Jan (jxn_30).
LSS Wachen/Fhz Navigation Hotkeys
Datei: LSS-Wachen-Fhz-Navigation-Hotkeys.user.js
Ergänzt Gebäude- und Fahrzeugseiten um Hotkeys. A/D beziehungsweise die Pfeiltasten wechseln zum vorherigen oder nächsten Eintrag; auf Gebäudeseiten stehen zusätzliche Schnellaktionen zur Verfügung.
NilsPe LSS Core
Datei: NilsPe-Skriptbasis.user.js
Gemeinsamer API-Cache und Einstellungsbaukasten für NilsPe-Userscripts.
- Lädt Gebäude, Verbandsgebäude, Fahrzeuge und POIs über die v2-API.
- Speichert API-Daten lokal in einer IndexedDB.
- Aktualisiert vorhandene Daten inkrementell.
- Lädt große Datenmengen seitenweise über die API-Paginierung.
- Stellt gemeinsame Einstellungs- und Hilfsfunktionen für weitere Skripte bereit.
