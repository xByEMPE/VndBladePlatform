import { describe, it, expect } from "vitest";
import {
  isValidCoordinate,
  parseCoordinates,
  getBounds,
  getInitialViewState,
  resolveTurbinePosition,
} from "./coordinates";

describe("isValidCoordinate", () => {
  it("acepta valores dentro de rango", () => {
    expect(isValidCoordinate(16.563631, -94.736723)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
  });

  it("acepta 0 en un solo eje (ecuador o meridiano de Greenwich)", () => {
    expect(isValidCoordinate(0, -94.7)).toBe(true);
    expect(isValidCoordinate(16.5, 0)).toBe(true);
  });

  it("rechaza 0,0 (isla nula)", () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it("rechaza fuera de rango, NaN, Infinity, null y vacíos", () => {
    expect(isValidCoordinate(91, 10)).toBe(false);
    expect(isValidCoordinate(10, 181)).toBe(false);
    expect(isValidCoordinate(NaN, 10)).toBe(false);
    expect(isValidCoordinate(10, Infinity)).toBe(false);
    expect(isValidCoordinate(null, 10)).toBe(false);
    expect(isValidCoordinate(10, undefined)).toBe(false);
    expect(isValidCoordinate("", "")).toBe(false);
  });
});

describe("parseCoordinates", () => {
  const expected = { lat: 16.563631, lon: -94.736723 };

  it("devuelve null para vacíos", () => {
    expect(parseCoordinates(null)).toBeNull();
    expect(parseCoordinates(undefined)).toBeNull();
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates({})).toBeNull();
    expect(parseCoordinates([])).toBeNull();
  });

  it("lee { lat, lng }, { lat, lon } y { latitude, longitude }", () => {
    expect(parseCoordinates({ lat: 16.563631, lng: -94.736723 })).toEqual(expected);
    expect(parseCoordinates({ lat: 16.563631, lon: -94.736723 })).toEqual(expected);
    expect(parseCoordinates({ latitude: 16.563631, longitude: -94.736723 })).toEqual(expected);
    expect(parseCoordinates({ gps_latitude: 16.563631, gps_longitude: -94.736723 })).toEqual(expected);
  });

  it("acepta números guardados como texto", () => {
    expect(parseCoordinates({ lat: "16.563631", lng: "-94.736723" })).toEqual(expected);
  });

  it("no confunde texto vacío con 0", () => {
    expect(parseCoordinates({ lat: "", lng: "" })).toBeNull();
    expect(parseCoordinates({ lat: "  ", lng: "-94.7" })).toBeNull();
  });

  it("lee GeoJSON Point con orden [lon, lat]", () => {
    expect(parseCoordinates({ type: "Point", coordinates: [-94.736723, 16.563631] })).toEqual(expected);
  });

  it("lee arreglo [lat, lon]", () => {
    expect(parseCoordinates([16.563631, -94.736723])).toEqual(expected);
  });

  it("corrige un arreglo claramente en orden [lon, lat]", () => {
    expect(parseCoordinates([-94.736723, 116.5])).toBeNull();
    expect(parseCoordinates([116.5, 39.9])).toEqual({ lat: 39.9, lon: 116.5 });
  });

  it("lee texto 'lat, lon' con coma, punto y coma o espacios", () => {
    expect(parseCoordinates("16.563631, -94.736723")).toEqual(expected);
    expect(parseCoordinates("16.563631,-94.736723")).toEqual(expected);
    expect(parseCoordinates("16.563631; -94.736723")).toEqual(expected);
    expect(parseCoordinates("16.563631 -94.736723")).toEqual(expected);
  });

  it("lee JSON serializado como texto", () => {
    expect(parseCoordinates('{"lat":16.563631,"lng":-94.736723}')).toEqual(expected);
    expect(parseCoordinates("[16.563631, -94.736723]")).toEqual(expected);
  });

  it("usa _raw como respaldo e ignora _section_aliases", () => {
    expect(parseCoordinates({ _raw: "16.563631, -94.736723", _section_aliases: { a: "b" } })).toEqual(expected);
    expect(
      parseCoordinates({ lat: 16.563631, lng: -94.736723, _section_aliases: { "Blade A": "Pala A" } }),
    ).toEqual(expected);
  });

  it("devuelve null para valores inválidos", () => {
    expect(parseCoordinates("sin coordenadas")).toBeNull();
    expect(parseCoordinates("{no es json")).toBeNull();
    expect(parseCoordinates({ lat: 0, lng: 0 })).toBeNull();
    expect(parseCoordinates({ lat: 95, lng: 10 })).toBeNull();
    expect(parseCoordinates({ lat: 10, lng: 200 })).toBeNull();
    expect(parseCoordinates({ lat: 10 })).toBeNull();
    expect(parseCoordinates(42)).toBeNull();
    expect(parseCoordinates(true)).toBeNull();
  });
});

describe("getBounds", () => {
  it("devuelve null sin puntos", () => {
    expect(getBounds([])).toBeNull();
    expect(getBounds(null)).toBeNull();
  });

  it("con un punto el rectángulo es degenerado", () => {
    expect(getBounds([{ lat: 16.5, lon: -94.7 }])).toEqual([
      [-94.7, 16.5],
      [-94.7, 16.5],
    ]);
  });

  it("calcula [[minLon, minLat], [maxLon, maxLat]] (orden de MapLibre)", () => {
    expect(
      getBounds([
        { lat: 16.5, lon: -94.7 },
        { lat: 16.7, lon: -94.5 },
        { lat: 16.6, lon: -94.9 },
      ]),
    ).toEqual([
      [-94.9, 16.5],
      [-94.5, 16.7],
    ]);
  });

  it("ignora puntos inválidos", () => {
    expect(getBounds([{ lat: 16.5, lon: -94.7 }, { lat: NaN, lon: 1 }, null])).toEqual([
      [-94.7, 16.5],
      [-94.7, 16.5],
    ]);
    expect(getBounds([{ lat: NaN, lon: 1 }])).toBeNull();
  });
});

describe("getInitialViewState", () => {
  it("devuelve null sin puntos válidos", () => {
    expect(getInitialViewState([])).toBeNull();
    expect(getInitialViewState([{ lat: NaN, lon: 1 }])).toBeNull();
  });

  it("con un solo punto centra en él con zoom fijo", () => {
    expect(getInitialViewState([{ lat: 16.563631, lon: -94.736723 }])).toEqual({
      longitude: -94.736723,
      latitude: 16.563631,
      zoom: 13,
    });
  });

  it("con puntos idénticos trata el caso como un solo punto", () => {
    const p = { lat: 16.5, lon: -94.7 };
    expect(getInitialViewState([p, { ...p }])).toEqual({ longitude: -94.7, latitude: 16.5, zoom: 13 });
  });

  it("con varios puntos encuadra el rectángulo con margen y zoom máximo", () => {
    expect(
      getInitialViewState([
        { lat: 16.5, lon: -94.7 },
        { lat: 16.7, lon: -94.5 },
      ]),
    ).toEqual({
      bounds: [
        [-94.7, 16.5],
        [-94.5, 16.7],
      ],
      fitBoundsOptions: { padding: 60, maxZoom: 14 },
    });
  });

  it("permite ajustar margen y zooms", () => {
    expect(getInitialViewState([{ lat: 1, lon: 1 }], { singleZoom: 10 }).zoom).toBe(10);
    expect(
      getInitialViewState(
        [
          { lat: 1, lon: 1 },
          { lat: 2, lon: 2 },
        ],
        { padding: 20, maxZoom: 9 },
      ).fitBoundsOptions,
    ).toEqual({ padding: 20, maxZoom: 9 });
  });
});

describe("resolveTurbinePosition", () => {
  const estimated = { lat: 16.563631, lon: -94.736723 };

  it("prioriza la coordenada registrada", () => {
    expect(resolveTurbinePosition({ lat: 17, lng: -95 }, estimated)).toEqual({
      lat: 17,
      lon: -95,
      source: "registered",
    });
  });

  it("usa la estimada por fotos si la registrada está vacía o es inválida", () => {
    expect(resolveTurbinePosition({}, estimated)).toEqual({ ...estimated, source: "estimated" });
    expect(resolveTurbinePosition({ lat: 0, lng: 0 }, estimated)).toEqual({ ...estimated, source: "estimated" });
    expect(resolveTurbinePosition(null, { lat: "16.563631", lon: "-94.736723" })).toEqual({
      ...estimated,
      source: "estimated",
    });
  });

  it("devuelve null si no hay ninguna posición válida", () => {
    expect(resolveTurbinePosition({}, null)).toBeNull();
    expect(resolveTurbinePosition(null, { lat: 0, lon: 0 })).toBeNull();
    expect(resolveTurbinePosition(undefined, undefined)).toBeNull();
  });
});
