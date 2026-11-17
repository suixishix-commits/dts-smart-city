/*
  阿布扎比主岛公开地理数据（OpenStreetMap）。由 scripts/osm/fetch-osm.mjs 发给 Overpass API，
  结果存为 scripts/osm/abu-dhabi-island.osm.json，build-geo.mjs 只读这个快照，构建不依赖网络。
  数据 © OpenStreetMap contributors，ODbL 许可。
*/
[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link)$"](24.395,54.300,24.525,54.505);
  way["natural"="coastline"](24.380,54.280,24.540,54.520);
)->.lines;
.lines out geom tags;
(
  node["place"~"^(suburb|neighbourhood|quarter)$"](24.395,54.300,24.525,54.505);
  nwr["name"]["tourism"~"^(attraction|museum)$"](24.395,54.300,24.525,54.505);
  nwr["name"]["leisure"~"^(park|stadium|sports_centre|marina)$"](24.395,54.300,24.525,54.505);
  nwr["name"]["shop"="mall"](24.395,54.300,24.525,54.505);
  nwr["name"]["amenity"~"^(hospital|ferry_terminal|university)$"](24.395,54.300,24.525,54.505);
  nwr["name"]["historic"](24.395,54.300,24.525,54.505);
  nwr["name"]["man_made"="lighthouse"](24.395,54.300,24.525,54.505);
)->.pois;
.pois out center tags;
