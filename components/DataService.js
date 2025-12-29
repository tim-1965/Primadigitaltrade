// DataService.js (deprecated in Netlify static build)
// This build is fully static. Country data is provided by ./countries.js
export const dataService = {
  async getCountries() {
    throw new Error('DataService disabled: use COUNTRIES from ./countries.js');
  }
};
