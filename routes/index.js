var express = require('express');
var router = express.Router();
var pg = require("pg"); // postgres module

// Connection
var username = "postgres"
var password = "postgres"
var host = "localhost:25432"
var database = "gis"
var conString = "postgres://" + username + ":" + password + "@" + host + "/" + database;

// Set up your database query to display GeoJSON
var getGeoJSON = function (select) {
    return `
    SELECT row_to_json(fc) AS data
        FROM ( 
            SELECT 'FeatureCollection' As type, 
                   array_to_json(array_agg(f)) As features 
              FROM ( 
                SELECT 'Feature' As type, ST_AsGeoJSON(geom)::json As geometry, row_to_json((id, name)) As properties, row_to_json(row) as info
                  FROM (
                    ${select}
                  ) as row
            ) As f
        ) As fc
    `;
}

var historic_options = [
    {
        name: 'Pamiatka',
        value: 'monument'
    },
    {
        name: 'Hrad',
        value: 'castle'
    },
    {
        name: 'Kláštor',
        value: 'monastery'
    },
    {
        name: 'Divadlo',
        value: 'theatre'
    },
    {
        name: 'Kostol',
        value: 'church'
    },
    {
        name: 'Cintorín',
        value: 'cemetry'
    },
    {
        name: 'Zámok',
        value: 'chateau'
    },
    {
        name: 'Mestské múry',
        value: 'citywalls'
    },
    {
        name: 'Hrobka',
        value: 'tomb'
    },
    {
        name: 'Kaplnka',
        value: 'chapel'
    }
];

var historic_trans = [
    {
        name: 'Pamiatka',
        value: 'monument'
    },
    {
        name: 'Hrad',
        value: 'castle'
    },
    {
        name: 'Kláštor',
        value: 'monastery'
    },
    {
        name: 'Divadlo',
        value: 'theatre'
    },
    {
        name: 'Kostol',
        value: 'church'
    },
    {
        name: 'Cintorín',
        value: 'cemetry'
    },
    {
        name: 'Zámok',
        value: 'chateau'
    },
    {
        name: 'Mestské múry',
        value: 'citywalls'
    },
    {
        name: 'Hrobka',
        value: 'tomb'
    },
    {
        name: 'Kaplnka',
        value: 'chapel'
    },
    {
        name: 'Parkovisko',
        value: 'parking'
    },
    {
        name: 'Priehrada',
        value: 'reservoir'
    },
    {
        name: 'Most',
        value: 'bridge'
    },
    {
        name: 'Mesto',
        value: 'city'
    }
];

var icon_settings = [
    {
        value: 'parking',
        icon: 'fas fa-parking'
    },
    {
        value: 'city',
        icon: 'fas fa-city'
    },
    {
        value: 'reservoir',
        icon: 'fas fa-water'
    },
    {
        value: 'bridge',
        icon: 'fas fa-road'
    },
    {
        value: 'monument',
        icon: 'fas fa-monument'
    },
    {
        value: 'castle',
        icon: 'fab fa-fort-awesome'
    },
    {
        value: 'monastery',
        icon: 'fas fa-vihara'
    },
    {
        value: 'theatre',
        icon: 'fas fa-theater-masks'
    },
    {
        value: 'church',
        icon: 'fas fa-church'
    },
    {
        value: 'cemetry',
        icon: 'fas fa-church'
    },
    {
        value: 'chateau',
        icon: 'fab fa-fort-awesome-alt'
    },
    {
        value: 'citywalls',
        icon: 'fas fa-archway'
    },
    {
        value: 'tomb',
        icon: 'fas fa-gopuram'
    },
    {
        value: 'chapel',
        icon: 'fas fa-church'
    }
]

// Selects
var query_map = `
    SELECT  distinct(lg.id), 
            lg.name, 
            lg.geom,
            ST_X(ST_Centroid(lg.geom)) as cent_long,
            ST_Y(ST_Centroid(lg.geom)) as cent_lat,
            'city' as type
       FROM planet_osm_polygon as lg 
      WHERE lg.name like 'Bratislava'
        AND lg.boundary = 'administrative' 
`;

var river_cross = `
    SELECT  distinct(place.id), 
            place.name as name, 
            ST_Centroid(place.geom) as geom,
            ST_X(ST_Centroid(place.geom)) as cent_long,
            ST_Y(ST_Centroid(place.geom)) as cent_lat,
            CASE 
                WHEN place.water IS NOT NULL THEN
                    place.water
                WHEN place.man_made IS NOT NULL THEN
                    place.man_made 
            END as type
       FROM planet_osm_polygon AS place
       JOIN planet_osm_line AS river ON (ST_Crosses(place.geom,river.geom))
      WHERE river.name = $1
		AND river.waterway = 'river'
        AND place.admin_level is null
        AND place.boundary is null
        AND (place.natural = 'water' OR place.man_made = 'bridge')
        AND (place.water <> 'river' OR place.water IS null)
        AND place.name IS NOT NULL
`;

var query_for_city = ` 
    SELECT  distinct(lg.id), 
            lg.name, 
            lg.geom,
            ST_X(ST_Centroid(lg.geom)) as cent_long,
            ST_Y(ST_Centroid(lg.geom)) as cent_lat,
            'city' as type
       FROM planet_osm_polygon as lg 
      WHERE lg.name like $1
        AND lg.boundary = 'administrative' 
        AND lg.name IS NOT NULL
`;

var query_for_historic = `
    SELECT  distinct(place.id), 
            place.name as name, 
            ST_Centroid(place.geom) as geom,
            ST_X(ST_Centroid(place.geom)) as cent_long,
            ST_Y(ST_Centroid(place.geom)) as cent_lat,
            place.historic as type
       FROM planet_osm_polygon AS city, 
            planet_osm_polygon AS place
      WHERE ST_Intersects(city.geom,place.geom)
        AND ST_Area(ST_Intersection(city.geom,place.geom)) != ST_Area(city.geom)
        AND place.name IS NOT NULL
        AND city.name = $1
        AND place.historic = ANY ($2)
`;

var query_find_around = `
    SELECT  distinct(lg.id), 
            lg.name,
            ST_Centroid(lg.geom) as geom,
            ST_X(ST_Centroid(lg.geom)) as cent_long,
            ST_Y(ST_Centroid(lg.geom)) as cent_lat,
            lg.historic as type,
            ST_Distance(lg.geom, ST_MakePoint($1,$2)::geography) as distance
       FROM planet_osm_polygon as lg
      WHERE ST_DWithin(lg.geom, ST_MakePoint($1,$2)::geography, $3)
        AND lg.admin_level is null
        AND lg.boundary is null
        AND lg.place is null
        AND lg.historic = ANY ($4)
        AND lg.name IS NOT NULL
      ORDER BY distance
`;

var query_parking = `
    SELECT distinct(parking.id),
           parking.name,
           parking.geom,
           ST_X(ST_Centroid(parking.geom)) as cent_long,
           ST_Y(ST_Centroid(parking.geom)) as cent_lat,
           'parking' as type,
           st_distance(ST_Centroid(place.geom), parking.geom) as dist
      FROM planet_osm_polygon place,
           planet_osm_point parking
     WHERE place.id = $1
       AND parking.amenity = 'parking'
     ORDER BY st_distance(ST_Centroid(place.geom), parking.geom)
     LIMIT 10
`;

var query_nearby_objects = `
    SELECT distinct(lg.id),
           lg.name,
           ST_Centroid(lg.geom) as geom,
           st_distance(lg.geom, ST_MakePoint($1,$2)::geography) as distance,
           ST_X(ST_Centroid(lg.geom)) as cent_long,
           ST_Y(ST_Centroid(lg.geom)) as cent_lat,
           lg.historic as type
      FROM planet_osm_polygon lg
     WHERE lg.admin_level is null
       AND lg.boundary is null
       AND lg.place is null
       AND lg.historic = ANY ($3)
       AND lg.name IS NOT NULL
     ORDER BY distance 
     LIMIT 20
`;

function getTypeName(type) {
    icon_type = historic_trans.filter(obj => {
                        return obj.value == type
                    })
    if (icon_type.length != 0){
        return icon_type[0].name;
    } else {
        return 'Neznámy';
    }
}

var renderQuery = function (query, page_res) {
    var client = new pg.Client(conString);
    client.connect();
    client.query(query, (err, db_res) => {
        if (err) {
            console.log(err.stack)
        } else {
            var data = db_res.rows[0].data
            if (!data.features){
                data.features = []
                message = 'Neboli nájdené žiadne dáta.'
            } else {
                message = '';
            }
            for (var i=0; i < data.features.length; i++) {
                data.features[i].info.type_text = getTypeName(data.features[i].info.type);
                console.log(data.features[i]);
            }
            page_res.render('map', {
                title: "Express API",
                jsonData: data,
                histArray: historic_options,
                icons: icon_settings,
                message: message
            });
        }
    })
}

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

/* GET the map page */
router.get('/map', function (req, res) {
    renderQuery({
        text: getGeoJSON(query_map),
        values: null,
    }, res);
});

/* GET the filtered page */
router.get('/filter*', function (req, page_res) {
    var city = req.query.city;
    if (city) {
        console.log("Request passed")
        renderQuery({
            text: getGeoJSON(query_for_city),
            values: [city],
        }, page_res);
    } else {
        console.log("Bad request detected");
        page_res.redirect('/map');
        return;
    };
});

/* GET the filtered page */
router.get('/show*', function (req, page_res) {
    var city = req.query.city;
    var type = req.query.type instanceof Array ? req.query.type : [req.query.type];
    if (city && type && type.length != 0) {
        console.log("Request passed")
        renderQuery({
            text: getGeoJSON(query_for_historic),
            values: [city, type],
        }, page_res);
    } else {
        console.log("Bad request detected");
        page_res.redirect('/map');
        return;
    };
});

/* GET the around page */
router.get('/around*', function (req, page_res) {
    var distance = req.query.distance;
    var type = req.query.type instanceof Array ? req.query.type : [req.query.type];
    var lat = req.query.lat;
    var long = req.query.long;
    if (distance && lat && long) {
        console.log("Request passed")
        renderQuery({
            text: getGeoJSON(query_find_around),
            values: [long, lat, distance, type],
        }, page_res);
    } else {
        console.log("Bad request detected");
        page_res.redirect('/map');
        return;
    };
});

/* GET the around page */
router.get('/parking*', function (req, page_res) {
    var id = req.query.id;
    if (id) {
        renderQuery({
            text: getGeoJSON(query_parking),
            values: [id],
        }, page_res);
    } else {
    console.log("Bad request detected");
    page_res.redirect('/map');
    return;
};
});

router.get('/near*', function (req, page_res) {
    var lat = req.query.lat;
    var long = req.query.long;
    var type = req.query.type instanceof Array ? req.query.type : [req.query.type];
    if (lat && long) {
        console.log("Request passed")
        renderQuery({
            text: getGeoJSON(query_nearby_objects),
            values: [long, lat, type],
        }, page_res);
    } else {
        console.log("Bad request detected");
        page_res.redirect('/map');
        return;
    };
});

router.get('/river*', function (req, page_res) {
    var river = req.query.river;
    if (river) {
        console.log("Request passed")
        renderQuery({
            text: getGeoJSON(river_cross),
            values: [river],
        }, page_res);
    } else {
        console.log("Bad request detected");
        res.redirect('/map');
        return;
    };
});

module.exports = router;
