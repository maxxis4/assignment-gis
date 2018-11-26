ALTER TABLE planet_osm_line ADD COLUMN geom geometry;
update planet_osm_line set geom=st_transform(way, 4326);
ALTER TABLE planet_osm_point ADD COLUMN geom geometry;
update planet_osm_point set geom=st_transform(way, 4326);
ALTER TABLE planet_osm_polygon ADD COLUMN geom geometry;
update planet_osm_polygon set geom=st_transform(way, 4326);
ALTER TABLE planet_osm_roads ADD COLUMN geom geometry;
update planet_osm_roads set geom=st_transform(way, 4326);

ALTER TABLE planet_osm_line RENAME COLUMN osm_id TO id;
ALTER TABLE planet_osm_point RENAME COLUMN osm_id TO id;
ALTER TABLE planet_osm_polygon RENAME COLUMN osm_id TO id;
ALTER TABLE planet_osm_roads RENAME COLUMN osm_id TO id;

ALTER TABLE planet_osm_polygon ADD COLUMN geom_center geometry;
update planet_osm_polygon set geom_center=ST_Centroid(geom);

CREATE INDEX planet_osm_line_geom_idx ON planet_osm_line USING GIST (geom);
CREATE INDEX planet_osm_point_geom_idx ON planet_osm_point USING GIST (geom);
CREATE INDEX planet_osm_polygon_geom_idx ON planet_osm_polygon USING GIST (geom);
CREATE INDEX planet_osm_roads_geom_idx ON planet_osm_roads USING GIST (geom);
CREATE INDEX planet_osm_polygon_cent_idx ON planet_osm_polygon USING GIST (ST_Centroid(geom));


CREATE INDEX planet_osm_polygon_name_idx ON planet_osm_polygon (name);
CREATE INDEX planet_osm_polygon_id_idx ON planet_osm_polygon (id);
CREATE INDEX planet_osm_point_amenity_idx ON planet_osm_point (amenity);
CREATE INDEX planet_osm_polygon_historic_idx ON planet_osm_polygon (historic);
CREATE INDEX planet_osm_line_name_idx ON planet_osm_line (name);

-- Refresh DB po indexoch
vacuum analyze planet_osm_line;
vacuum analyze planet_osm_polygon;
vacuum analyze planet_osm_point;