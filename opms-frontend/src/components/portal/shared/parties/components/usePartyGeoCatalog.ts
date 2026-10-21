"use client";

import { useMemo } from "react";
import {
  useListPartyCountriesQuery,
  useListPartyStatesQuery,
  useListPartyCitiesQuery,
} from "@/store/api";
import {
  buildPartyGeoResolver,
  type PartyGeoCatalog,
  type PartyGeoCountry,
  type PartyGeoState,
  type PartyGeoCity,
} from "@/lib/partyGeo";

export function usePartyGeoFullCatalog(enabled = true) {
  const { data: countriesData, isLoading: loadingCountries } = useListPartyCountriesQuery(
    { limit: 500, status: "active" },
    { skip: !enabled }
  );
  const { data: statesData, isLoading: loadingStates } = useListPartyStatesQuery(
    { limit: 5000, status: "active" },
    { skip: !enabled }
  );
  const { data: citiesData, isLoading: loadingCities } = useListPartyCitiesQuery(
    { limit: 10000, status: "active" },
    { skip: !enabled }
  );

  const catalog: PartyGeoCatalog = useMemo(() => {
    const countries = (Array.isArray(countriesData?.data) ? countriesData.data : []) as PartyGeoCountry[];
    const states = (Array.isArray(statesData?.data) ? statesData.data : []) as PartyGeoState[];
    const cities = (Array.isArray(citiesData?.data) ? citiesData.data : []) as PartyGeoCity[];
    return { countries, states, cities };
  }, [countriesData, statesData, citiesData]);

  const resolver = useMemo(() => buildPartyGeoResolver(catalog), [catalog]);

  return {
    catalog,
    resolver,
    isLoading: loadingCountries || loadingStates || loadingCities,
  };
}

export function usePartyGeoCascading(countryId: string, stateId: string, enabled = true) {
  const { catalog, resolver, isLoading: loadingBase } = usePartyGeoFullCatalog(enabled);

  const states = useMemo(
    () => (countryId ? resolver.stateOptionsForCountry(countryId) : []),
    [resolver, countryId]
  );

  const cities = useMemo(
    () => (stateId ? resolver.cityOptionsForState(stateId) : []),
    [resolver, stateId]
  );

  return {
    countries: catalog.countries,
    states,
    cities,
    resolver,
    isLoading: loadingBase,
  };
}
