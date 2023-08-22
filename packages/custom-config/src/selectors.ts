export interface State {
	fetchAllMiddlewareConfig: FetchAllMiddlewareConfig;
	saveEntityRecordConfig: SaveEntityRecordConfig;
}

export interface FetchAllMiddlewareConfig {
	itemsPerPage: number;
}

export interface SaveEntityRecordConfig {
	reusableBlocksRefreshDebounceTime: number;
}

/**
 * Retrieve custom core configurations
 *
 * @param  state
 * @return Custom core configurations object
 */
export function getFetchAllMiddlewareConfig( state: State ) {
	return state.fetchAllMiddlewareConfig;
}

/**
 * Retrieve saveEntityRecord configuration.
 *
 * @param  state
 * @return Save entity record configuration
 */
export function getSaveEntityRecordConfig( state: State ) {
	return state.saveEntityRecordConfig;
}
