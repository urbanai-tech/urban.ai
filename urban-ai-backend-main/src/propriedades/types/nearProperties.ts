// To parse this data:
//
//   import { Convert, APITypes } from "./file";
//
//   const aPITypes = Convert.toAPITypes(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface APITypes {
    id:           string;
    latitude:     number;
    longitude:    number;
    bedrooms:     number;
    bathrooms:    number;
    accommodates: number;
    created_at:   Date;
    radius:       number;
    comps_status: string;
    comps:        Comp[];
    kpis:         Kpis;
}

export interface Comp {
    listingID:                     string;
    bathrooms:                     number;
    bedrooms:                      string;
    accommodates:                  number;
    name:                          string;
    thumbnail_url:                 string;
    host_id:                       string;
    host_name:                     string;
    room_type:                     RoomType;
    latitude:                      number;
    longitude:                     number;
    minimum_nights:                number;
    visible_review_count:          number;
    reveiw_scores_rating:          number | null;
    amenities:                     { [key: string]: boolean };
    cleaning_fee:                  number | null;
    annual_revenue_ltm:            number;
    revenue_potential:             number;
    avg_occupancy_rate_ltm:        number;
    avg_booked_daily_rate_ltm:     number;
    active_days_count_ltm:         number;
    no_of_bookings_ltm:            number | null;
    booked_daily_rate_ltm_monthly: { [key: string]: number | null };
    revenue_ltm_monthly:           { [key: string]: number | null };
    occupancy_rate_ltm_monthly:    { [key: string]: number | null };
    no_of_bookings_ltm_monthly:    { [key: string]: number | null };
    is_selected:                   number;
    last_seen:                     Date;
    thumbnail_url_extended:        null;
    rank:                          number;
    similarity_score_meta:         SimilarityScoreMeta;
    similarity_score:              number;
    distance:                      number;
}

export enum RoomType {
    EntireHome = "entire_home",
    PrivateRoom = "private_room",
}

export interface SimilarityScoreMeta {
    pool_score:           number;
    bedroom_score:        number;
    revenue_score:        number;
    bathroom_score:       number;
    proximity_score:      number;
    review_penalizer:     number;
    accommodates_score:   number;
    activity_penalizer:   number;
    occupancy_rate_score: number;
}

export interface Kpis {
    "25":   The25;
    "50":   The25;
    "75":   The25;
    "90":   The25;
    edited: The25;
}

export interface The25 {
    ltm_revenue:            number;
    ltm_occupancy_rate:     number;
    ltm_nightly_rate:       number;
    monthly_revenue:        { [key: string]: number | null } | null;
    monthly_occupancy_rate: { [key: string]: number | null } | null;
    monthly_adr:            { [key: string]: number | null } | null;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toAPITypes(json: string): APITypes {
        return cast(JSON.parse(json), r("APITypes"));
    }

    public static aPITypesToJson(value: APITypes): string {
        return JSON.stringify(uncast(value, r("APITypes")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "APITypes": o([
        { json: "id", js: "id", typ: "" },
        { json: "latitude", js: "latitude", typ: 3.14 },
        { json: "longitude", js: "longitude", typ: 3.14 },
        { json: "bedrooms", js: "bedrooms", typ: 0 },
        { json: "bathrooms", js: "bathrooms", typ: 0 },
        { json: "accommodates", js: "accommodates", typ: 0 },
        { json: "created_at", js: "created_at", typ: Date },
        { json: "radius", js: "radius", typ: 0 },
        { json: "comps_status", js: "comps_status", typ: "" },
        { json: "comps", js: "comps", typ: a(r("Comp")) },
        { json: "kpis", js: "kpis", typ: r("Kpis") },
    ], false),
    "Comp": o([
        { json: "listingID", js: "listingID", typ: "" },
        { json: "bathrooms", js: "bathrooms", typ: 0 },
        { json: "bedrooms", js: "bedrooms", typ: "" },
        { json: "accommodates", js: "accommodates", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "thumbnail_url", js: "thumbnail_url", typ: "" },
        { json: "host_id", js: "host_id", typ: "" },
        { json: "host_name", js: "host_name", typ: "" },
        { json: "room_type", js: "room_type", typ: r("RoomType") },
        { json: "latitude", js: "latitude", typ: 3.14 },
        { json: "longitude", js: "longitude", typ: 3.14 },
        { json: "minimum_nights", js: "minimum_nights", typ: 0 },
        { json: "visible_review_count", js: "visible_review_count", typ: 0 },
        { json: "reveiw_scores_rating", js: "reveiw_scores_rating", typ: u(0, null) },
        { json: "amenities", js: "amenities", typ: m(true) },
        { json: "cleaning_fee", js: "cleaning_fee", typ: u(3.14, null) },
        { json: "annual_revenue_ltm", js: "annual_revenue_ltm", typ: 0 },
        { json: "revenue_potential", js: "revenue_potential", typ: 0 },
        { json: "avg_occupancy_rate_ltm", js: "avg_occupancy_rate_ltm", typ: 0 },
        { json: "avg_booked_daily_rate_ltm", js: "avg_booked_daily_rate_ltm", typ: 0 },
        { json: "active_days_count_ltm", js: "active_days_count_ltm", typ: 0 },
        { json: "no_of_bookings_ltm", js: "no_of_bookings_ltm", typ: u(0, null) },
        { json: "booked_daily_rate_ltm_monthly", js: "booked_daily_rate_ltm_monthly", typ: m(u(0, null)) },
        { json: "revenue_ltm_monthly", js: "revenue_ltm_monthly", typ: m(u(0, null)) },
        { json: "occupancy_rate_ltm_monthly", js: "occupancy_rate_ltm_monthly", typ: m(u(0, null)) },
        { json: "no_of_bookings_ltm_monthly", js: "no_of_bookings_ltm_monthly", typ: m(u(0, null)) },
        { json: "is_selected", js: "is_selected", typ: 0 },
        { json: "last_seen", js: "last_seen", typ: Date },
        { json: "thumbnail_url_extended", js: "thumbnail_url_extended", typ: null },
        { json: "rank", js: "rank", typ: 0 },
        { json: "similarity_score_meta", js: "similarity_score_meta", typ: r("SimilarityScoreMeta") },
        { json: "similarity_score", js: "similarity_score", typ: 3.14 },
        { json: "distance", js: "distance", typ: 3.14 },
    ], false),
    "SimilarityScoreMeta": o([
        { json: "pool_score", js: "pool_score", typ: 0 },
        { json: "bedroom_score", js: "bedroom_score", typ: 3.14 },
        { json: "revenue_score", js: "revenue_score", typ: 3.14 },
        { json: "bathroom_score", js: "bathroom_score", typ: 3.14 },
        { json: "proximity_score", js: "proximity_score", typ: 3.14 },
        { json: "review_penalizer", js: "review_penalizer", typ: 3.14 },
        { json: "accommodates_score", js: "accommodates_score", typ: 3.14 },
        { json: "activity_penalizer", js: "activity_penalizer", typ: 3.14 },
        { json: "occupancy_rate_score", js: "occupancy_rate_score", typ: 3.14 },
    ], false),
    "Kpis": o([
        { json: "25", js: "25", typ: r("The25") },
        { json: "50", js: "50", typ: r("The25") },
        { json: "75", js: "75", typ: r("The25") },
        { json: "90", js: "90", typ: r("The25") },
        { json: "edited", js: "edited", typ: r("The25") },
    ], false),
    "The25": o([
        { json: "ltm_revenue", js: "ltm_revenue", typ: 0 },
        { json: "ltm_occupancy_rate", js: "ltm_occupancy_rate", typ: 0 },
        { json: "ltm_nightly_rate", js: "ltm_nightly_rate", typ: 0 },
        { json: "monthly_revenue", js: "monthly_revenue", typ: u(m(u(0, null)), null) },
        { json: "monthly_occupancy_rate", js: "monthly_occupancy_rate", typ: u(m(u(0, null)), null) },
        { json: "monthly_adr", js: "monthly_adr", typ: u(m(u(0, null)), null) },
    ], false),
    "RoomType": [
        "entire_home",
        "private_room",
    ],
};