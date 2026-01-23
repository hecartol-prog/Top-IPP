import Companies from './pages/Companies';
import Dashboard from './pages/Dashboard';
import Integrations from './pages/Integrations';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Companies": Companies,
    "Dashboard": Dashboard,
    "Integrations": Integrations,
    "Leads": Leads,
    "Pipeline": Pipeline,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};