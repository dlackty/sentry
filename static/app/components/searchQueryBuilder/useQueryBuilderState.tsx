import {type Reducer, useCallback, useReducer} from 'react';

import {
  type ParseResultToken,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';

type QueryBuilderState = {
  query: string;
};

type DeleteTokenAction = {
  token: ParseResultToken;
  type: 'DELETE_TOKEN';
};

type UpdateFreeTextAction = {
  text: string;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
  type: 'UPDATE_FREE_TEXT';
};

type UpdateFilterOpAction = {
  op: TermOperator;
  token: TokenResult<Token.FILTER>;
  type: 'UPDATE_FILTER_OP';
};

type UpdateTokenValueAction = {
  token: TokenResult<Token>;
  type: 'UPDATE_TOKEN_VALUE';
  value: string;
};

type MultiSelectFilterValueAction = {
  token: TokenResult<Token.FILTER>;
  type: 'TOGGLE_FILTER_VALUE';
  value: string;
};

type DeleteLastMultiSelectFilterValueAction = {
  token: TokenResult<Token.FILTER>;
  type: 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE';
};

export type QueryBuilderActions =
  | DeleteTokenAction
  | UpdateFreeTextAction
  | UpdateFilterOpAction
  | UpdateTokenValueAction
  | MultiSelectFilterValueAction
  | DeleteLastMultiSelectFilterValueAction;

function removeQueryToken(query: string, token: TokenResult<Token>): string {
  return (
    query.substring(0, token.location.start.offset) +
    query.substring(token.location.end.offset)
  );
}

function modifyFilterOperator(
  query: string,
  token: TokenResult<Token.FILTER>,
  newOperator: TermOperator
): string {
  const isNotEqual = newOperator === TermOperator.NOT_EQUAL;

  token.operator = isNotEqual ? TermOperator.DEFAULT : newOperator;
  token.negated = isNotEqual;

  return (
    query.substring(0, token.location.start.offset) +
    stringifyToken(token) +
    query.substring(token.location.end.offset)
  );
}

function replaceQueryToken(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  const start = query.substring(0, token.location.start.offset);
  const end = query.substring(token.location.end.offset);

  return start + value + end;
}

// Ensures that the replaced token is separated from the rest of the query
// and cleans up any extra whitespace
function replaceTokenWithPadding(
  query: string,
  token: TokenResult<Token>,
  value: string
): string {
  const start = query.substring(0, token.location.start.offset);
  const end = query.substring(token.location.end.offset);

  return (start.trimEnd() + ' ' + value.trim() + ' ' + end.trimStart()).trim();
}

function updateFreeText(
  state: QueryBuilderState,
  action: UpdateFreeTextAction
): QueryBuilderState {
  const newQuery = replaceTokenWithPadding(state.query, action.token, action.text);

  return {
    ...state,
    query: newQuery,
  };
}

function updateFilterMultipleValues(
  state: QueryBuilderState,
  token: TokenResult<Token.FILTER>,
  values: string[]
) {
  const uniqNonEmptyValues = Array.from(
    new Set(values.filter(value => value.length > 0))
  );
  if (uniqNonEmptyValues.length === 0) {
    return {...state, query: replaceQueryToken(state.query, token.value, '')};
  }

  const newValue =
    uniqNonEmptyValues.length > 1
      ? `[${uniqNonEmptyValues.join(',')}]`
      : uniqNonEmptyValues[0];

  return {...state, query: replaceQueryToken(state.query, token.value, newValue)};
}

function multiSelectTokenValue(
  state: QueryBuilderState,
  action: MultiSelectFilterValueAction
) {
  const tokenValue = action.token.value;

  switch (tokenValue.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      const values = tokenValue.items.map(item => item.value?.text ?? '');
      const containsValue = values.includes(action.value);
      const newValues = containsValue
        ? values.filter(value => value !== action.value)
        : [...values, action.value];

      return updateFilterMultipleValues(state, action.token, newValues);
    default:
      if (tokenValue.text === action.value) {
        return updateFilterMultipleValues(state, action.token, ['']);
      }
      return updateFilterMultipleValues(state, action.token, [
        tokenValue.text,
        action.value,
      ]);
  }
}

function deleteLastMultiSelectTokenValue(
  state: QueryBuilderState,
  action: DeleteLastMultiSelectFilterValueAction
) {
  const tokenValue = action.token.value;

  switch (tokenValue.type) {
    case Token.VALUE_TEXT_LIST:
    case Token.VALUE_NUMBER_LIST:
      const newValues = tokenValue.items.slice(0, -1).map(item => item.value?.text ?? '');

      return updateFilterMultipleValues(state, action.token, newValues);
    default:
      return updateFilterMultipleValues(state, action.token, ['']);
  }
}

export function useQueryBuilderState({initialQuery}: {initialQuery: string}) {
  const initialState: QueryBuilderState = {query: initialQuery};

  const reducer: Reducer<QueryBuilderState, QueryBuilderActions> = useCallback(
    (state, action): QueryBuilderState => {
      switch (action.type) {
        case 'DELETE_TOKEN':
          return {
            query: removeQueryToken(state.query, action.token),
          };
        case 'UPDATE_FREE_TEXT':
          return updateFreeText(state, action);
        case 'UPDATE_FILTER_OP':
          return {
            query: modifyFilterOperator(state.query, action.token, action.op),
          };
        case 'UPDATE_TOKEN_VALUE':
          return {
            query: replaceQueryToken(state.query, action.token, action.value),
          };
        case 'TOGGLE_FILTER_VALUE':
          return multiSelectTokenValue(state, action);
        case 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE':
          return deleteLastMultiSelectTokenValue(state, action);
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    state,
    dispatch,
  };
}
