import React from 'react';
import {PlainRoute} from 'react-router';

import {openHelpSearchModal, openSudo} from 'app/actionCreators/modal';
import Access from 'app/components/acl/access';
import {toggleLocaleDebug} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {createFuzzySearch, isResultWithMatches} from 'app/utils/createFuzzySearch';

import {Result} from './types';

type Action = {
  title: string;
  description: string;
  requiresSuperuser: boolean;
  action: () => void;
};

const ACTIONS: Action[] = [
  {
    title: 'Open Sudo Modal',
    description: 'Open Sudo Modal to re-identify yourself.',
    requiresSuperuser: false,
    action: () =>
      openSudo({
        sudo: true,
      }),
  },

  {
    title: 'Open Superuser Modal',
    description: 'Open Superuser Modal to re-identify yourself.',
    requiresSuperuser: true,
    action: () =>
      openSudo({
        superuser: true,
      }),
  },

  {
    title: 'Toggle dark mode',
    description: 'Toggle dark mode (superuser only atm)',
    requiresSuperuser: true,
    action: () =>
      ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark'),
  },

  {
    title: 'Toggle Translation Markers',
    description: 'Toggles translation markers on or off in the application',
    requiresSuperuser: true,
    action: () => toggleLocaleDebug(),
  },

  {
    title: 'Search Documentation and FAQ',
    description: 'Open the Documentation and FAQ search modal.',
    requiresSuperuser: false,
    action: () => {
      openHelpSearchModal();
    },
  },
];

type ChildProps = {
  /**
   * Whether or not results are being loaded.
   */
  isLoading: boolean;
  /**
   * Unused. Only present to be conformant with other search sources.
   * */
  allResults: Result[];
  /**
   * Results with the filter query applied.
   */
  results: Result[];
};

type Props = {
  /**
   * search term
   */
  query: string;
  isSuperuser: boolean;
  children: (props: ChildProps) => React.ReactElement;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.FuseOptions<Action>;
  /**
   * Array of routes to search
   */
  searchMap?: PlainRoute[];
};

type State = {
  fuzzy: null | Fuse<Action, Fuse.FuseOptions<Action>>;
};

/**
 * This source is a hardcoded list of action creators and/or routes maybe
 */
class CommandSource extends React.Component<Props, State> {
  static defaultProps = {
    searchMap: [],
    searchOptions: {},
  };

  state: State = {
    fuzzy: null,
  };

  componentDidMount() {
    this.createSearch(ACTIONS);
  }

  async createSearch(searchMap: Action[]) {
    const options = {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
    };
    this.setState({
      fuzzy: await createFuzzySearch<Action>(searchMap || [], options),
    });
  }

  render() {
    const {searchMap, query, isSuperuser, children} = this.props;

    const results: Result[] = [];
    if (this.state.fuzzy) {
      const rawResults = this.state.fuzzy.search(query);
      rawResults.forEach(value => {
        if (!isResultWithMatches(value)) {
          return;
        }
        const {item, ...rest} = value;
        if (value.item.requiresSuperuser && !isSuperuser) {
          return;
        }
        results.push({
          item: {
            ...item,
            sourceType: 'command',
            resultType: 'command',
          },
          ...rest,
        });
      });
    }

    return children({
      isLoading: searchMap === null,
      allResults: [],
      results,
    });
  }
}

const CommandSourceWithFeature = (props: Omit<Props, 'isSuperuser'>) => (
  <Access isSuperuser>
    {({hasSuperuser}) => <CommandSource {...props} isSuperuser={hasSuperuser} />}
  </Access>
);

export default CommandSourceWithFeature;
export {CommandSource};
