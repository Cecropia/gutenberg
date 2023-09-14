export interface State {
	fetchAllMiddlewareConfig: FetchAllMiddlewareConfig;
}

export interface FetchAllMiddlewareConfig {
	itemsPerPage: number;
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
