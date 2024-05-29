from snuba_sdk import Condition, Granularity

from sentry.search.events import constants
from sentry.search.events.builder import (
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.datasets.spans_metrics import SpansMetricsDatasetConfig
from sentry.search.events.types import SelectType


class SpansMetricsQueryBuilder(MetricsQueryBuilder):
    requires_organization_condition = True
    spans_metrics_builder = True
    has_transaction = False

    column_remapping = {
        # We want to remap `message` to `span.description` for the free
        # text search use case so that it searches the `span.description`
        # when the user performs a free text search
        "message": "span.description",
    }

    def load_config(self):
        self.config = SpansMetricsDatasetConfig(self)
        return self.parse_config(self.config)

    @property
    def use_default_tags(self) -> bool:
        return False

    def get_field_type(self, field: str) -> str | None:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.self_time"]:
            return "duration"

        return None

    def resolve_select(
        self, selected_columns: list[str] | None, equations: list[str] | None
    ) -> list[SelectType]:
        if selected_columns and "transaction" in selected_columns:
            self.has_transaction = True
        return super().resolve_select(selected_columns, equations)

    def resolve_metric_index(self, value: str) -> int | None:
        """Layer on top of the metric indexer so we'll only hit it at most once per value"""

        # This check is a bit brittle, and depends on resolve_conditions happening before resolve_select
        if value == "transaction":
            self.has_transaction = True
        if not self.has_transaction and value == constants.SPAN_METRICS_MAP["span.self_time"]:
            return super().resolve_metric_index(constants.SELF_TIME_LIGHT)

        return super().resolve_metric_index(value)


class TimeseriesSpansMetricsQueryBuilder(SpansMetricsQueryBuilder, TimeseriesMetricQueryBuilder):
    def resolve_split_granularity(self) -> tuple[list[Condition], Granularity | None]:
        """Don't do this for timeseries"""
        return [], self.granularity


class TopSpansMetricsQueryBuilder(TimeseriesSpansMetricsQueryBuilder, TopMetricsQueryBuilder):
    pass
