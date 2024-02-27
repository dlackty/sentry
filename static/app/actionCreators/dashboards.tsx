import {cloneDeep} from 'lodash';
import omit from 'lodash/omit';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {PageFilters} from 'sentry/types';
import {
  type DashboardDetails,
  type DashboardListItem,
  type Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {flattenErrors} from 'sentry/views/dashboards/utils';

export function fetchDashboards(api: Client, orgSlug: string) {
  const promise: Promise<DashboardListItem[]> = api.requestPromise(
    `/organizations/${orgSlug}/dashboards/`,
    {
      method: 'GET',
      query: {sort: 'myDashboardsAndRecentlyViewed'},
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      const errors = flattenErrors(errorResponse, {});
      addErrorMessage(errors[Object.keys(errors)[0]] as string);
    } else {
      addErrorMessage(t('Unable to fetch dashboards'));
    }
  });

  return promise;
}

export function createDashboard(
  api: Client,
  orgSlug: string,
  newDashboard: DashboardDetails,
  duplicate?: boolean
): Promise<DashboardDetails> {
  const {title, widgets, projects, environment, period, start, end, filters, utc} =
    newDashboard;

  const promise: Promise<DashboardDetails> = api.requestPromise(
    `/organizations/${orgSlug}/dashboards/`,
    {
      method: 'POST',
      data: {
        title,
        widgets: widgets.map(widget => omit(widget, ['tempId'])),
        duplicate,
        projects,
        environment,
        period,
        start,
        end,
        filters,
        utc,
      },
      query: {
        project: projects,
        environment,
      },
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      const errors = flattenErrors(errorResponse, {});
      addErrorMessage(errors[Object.keys(errors)[0]] as string);
    } else {
      addErrorMessage(t('Unable to create dashboard'));
    }
  });

  return promise;
}

export function updateDashboardVisit(
  api: Client,
  orgId: string,
  dashboardId: string | string[]
): Promise<void> {
  const promise = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboardId}/visit/`,
    {
      method: 'POST',
    }
  );

  return promise;
}

export function fetchDashboard(
  api: Client,
  orgId: string,
  dashboardId: string
): Promise<DashboardDetails> {
  const promise: Promise<DashboardDetails> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboardId}/`,
    {
      method: 'GET',
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      const errors = flattenErrors(errorResponse, {});
      addErrorMessage(errors[Object.keys(errors)[0]] as string);
    } else {
      addErrorMessage(t('Unable to load dashboard'));
    }
  });
  return promise;
}

export function updateDashboard(
  api: Client,
  orgId: string,
  dashboard: DashboardDetails
): Promise<DashboardDetails> {
  const {title, widgets, projects, environment, period, start, end, filters, utc} =
    dashboard;
  const data = {
    title,
    widgets: widgets.map(widget => modifyWidgetDataset(omit(widget, ['tempId']))),
    projects,
    environment,
    period,
    start,
    end,
    filters,
    utc,
  };

  const promise: Promise<DashboardDetails> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboard.id}/`,
    {
      method: 'PUT',
      data,
      query: {
        project: projects,
        environment,
      },
    }
  );

  // We let the callers of `updateDashboard` handle adding a success message, so
  // that it can be more specific than just "Dashboard updated," but do the
  // error-handling here, since it doesn't depend on the caller's context
  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      const errors = flattenErrors(errorResponse, {});
      addErrorMessage(errors[Object.keys(errors)[0]] as string);
    } else {
      addErrorMessage(t('Unable to update dashboard'));
    }
  });

  return promise;
}

function modifyWidgetDataset(widget: Widget) {
  const newWidget = cloneDeep(widget);
  if (isSplitDiscoverWidgetType(widget.widgetType)) {
    newWidget.widgetType = overrideWidgetType(widget.widgetType);
  }
  return newWidget;
}

export const overrideWidgetType = (widgetType?: WidgetType) => {
  // TODO: Remove this after we've fully migrated to split discover set in the widgetType column.
  if (isSplitDiscoverWidgetType(widgetType)) {
    // We return discover and override the widgetType since we're not yet saving the split to the widgetType column
    return WidgetType.DISCOVER;
  }
  return widgetType;
};

export const isSplitDiscoverWidgetType = (widgetType?: WidgetType) => {
  return (
    widgetType &&
    [WidgetType.ERROR_EVENTS, WidgetType.TRANSACTION_LIKE].includes(widgetType)
  );
};

export function deleteDashboard(
  api: Client,
  orgId: string,
  dashboardId: string
): Promise<undefined> {
  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboardId}/`,
    {
      method: 'DELETE',
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      const errors = flattenErrors(errorResponse, {});
      addErrorMessage(errors[Object.keys(errors)[0]] as string);
    } else {
      addErrorMessage(t('Unable to delete dashboard'));
    }
  });

  return promise;
}

export function validateWidgetRequest(
  orgId: string,
  widget: Widget,
  selection: PageFilters
) {
  return [
    `/organizations/${orgId}/dashboards/widgets/`,
    {
      method: 'POST',
      data: widget,
      query: {
        // TODO: This should be replaced in the future with projects
        // when we save Dashboard page filters. This is being sent to
        // bypass validation when creating or updating dashboards
        project: [ALL_ACCESS_PROJECTS],
        environment: selection.environments,
      },
    },
  ] as const;
}

export function validateWidget(
  api: Client,
  orgId: string,
  widget: Widget
): Promise<undefined> {
  const {selection} = PageFiltersStore.getState();
  const widgetQuery = validateWidgetRequest(orgId, widget, selection);
  const promise: Promise<undefined> = api.requestPromise(widgetQuery[0], widgetQuery[1]);
  return promise;
}
