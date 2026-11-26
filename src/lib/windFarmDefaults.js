// Valores por defecto de un proyecto al elegir su parque del catálogo (wind_farms).
//  - turbine_count: el conteo REAL de wind_turbines manda; si el parque aún no tiene aerogeneradores cargados,
//    se usa el total de referencia del catálogo (metadata.expected_turbines).
//  - turbine_model: los modelos del catálogo (metadata.turbine_models) unidos con " / ".
// La consulta del catálogo trae wind_turbines(count) → farm.wind_turbines = [{ count }].
export function farmDefaults(farm) {
  if (!farm) return { turbine_count: "", turbine_model: "" };
  const real = Number(farm.wind_turbines?.[0]?.count) || 0;
  const meta = farm.metadata && typeof farm.metadata === "object" ? farm.metadata : {};
  const expected = Number(meta.expected_turbines) || 0;
  const count = real > 0 ? real : expected;
  const models = Array.isArray(meta.turbine_models) ? meta.turbine_models.filter(Boolean) : [];
  return {
    turbine_count: count > 0 ? String(count) : "",
    turbine_model: models.join(" / "),
  };
}
