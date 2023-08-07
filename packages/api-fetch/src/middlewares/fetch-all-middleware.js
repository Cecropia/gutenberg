/**
 * WordPress dependencies
 */
import { addQueryArgs } from '@wordpress/url';

/**
 * Internal dependencies
 */
import apiFetch from '..';

/**
 * Apply query arguments to both URL and Path, whichever is present.
 *
 * @param {import('../types').APIFetchOptions} props
 * @param {Record<string, string | number>}    queryArgs
 * @return {import('../types').APIFetchOptions} The request with the modified query args
 */
const modifyQuery = ( { path, url, ...options }, queryArgs ) => ( {
	...options,
	url: url && addQueryArgs( url, queryArgs ),
	path: path && addQueryArgs( path, queryArgs ),
} );

/**
 * Duplicates parsing functionality from apiFetch.
 *
 * @param {Response} response
 * @return {Promise<any>} Parsed response json.
 */
const parseResponse = ( response ) =>
	response.json ? response.json() : Promise.reject( response );

/**
 * @param {string | null} linkHeader
 * @return {{ next?: string }} The parsed link header.
 */
const parseLinkHeader = ( linkHeader ) => {
	if ( ! linkHeader ) {
		return {};
	}
	const match = linkHeader.match( /<([^>]+)>; rel="next"/ );
	return match
		? {
				next: match[ 1 ],
		  }
		: {};
};

/**
 * @param {Response} response
 * @return {string | undefined} The next page URL.
 */
const getNextPageUrl = ( response ) => {
	const { next } = parseLinkHeader( response.headers.get( 'link' ) );
	return next;
};

/**
 *
 * @param {Response} response
 * @return {number | undefined} The total pages available.
 */
const getTotalPages = ( response ) => {
	const totalPagesString = response.headers.get( 'X-Wp-Totalpages' ) ?? '';

	const totalPages = parseInt( totalPagesString, 10 );

	if ( ! Number.isInteger( totalPages ) ) {
		return;
	}

	return totalPages;
};
/**
 * @param {import('../types').APIFetchOptions} options
 * @return {boolean} True if the request contains an unbounded query.
 */
const requestContainsUnboundedQuery = ( options ) => {
	const pathIsUnbounded =
		!! options.path && options.path.indexOf( 'per_page=-1' ) !== -1;
	const urlIsUnbounded =
		!! options.url && options.url.indexOf( 'per_page=-1' ) !== -1;
	return pathIsUnbounded || urlIsUnbounded;
};

/**
 * The REST API enforces an upper limit on the per_page option. To handle large
 * collections, apiFetch consumers can pass `per_page=-1`; this middleware will
 * then recursively assemble a full response array from all available pages.
 *
 * @type {import('../types').APIFetchMiddleware}
 */
const fetchAllMiddleware = async ( options, next ) => {
	if ( options.parse === false ) {
		// If a consumer has opted out of parsing, do not apply middleware.
		return next( options );
	}
	if ( ! requestContainsUnboundedQuery( options ) ) {
		// If neither url nor path is requesting all items, do not apply middleware.
		return next( options );
	}

	const initialQuery = modifyQuery( options, {
		per_page: 100,
	} );

	// Retrieve requested page of results.
	const response = await apiFetch( {
		...initialQuery,
		// Ensure headers are returned for page 1.
		parse: false,
	} );

	const firstPageResult = await parseResponse( response );

	if ( ! Array.isArray( firstPageResult ) ) {
		// We have no reliable way of merging non-array results.
		return firstPageResult;
	}

	const nextPage = getNextPageUrl( response );

	if ( ! nextPage ) {
		// There are no further pages to request.
		return firstPageResult;
	}

	const totalPagesAvailable = getTotalPages( response ) ?? 0;

	//Ignores the first page because it was previously fetched.
	const remainingPagesToRequest = Math.max( totalPagesAvailable - 1, 0 );

	// Fetch the remaining pages in parallel.
	const restPagesPromiseBatch = [];

	for (
		let remainingPagesToRequestIndex = 0;
		remainingPagesToRequestIndex < remainingPagesToRequest;
		remainingPagesToRequestIndex++
	) {
		// Ignores the first page.
		const pageToRequestUrl = `${ initialQuery.url }&page=${
			remainingPagesToRequestIndex + 2
		}`;

		const pageToRequestPromise = apiFetch( {
			...options,
			path: undefined,
			url: pageToRequestUrl,
		} );

		restPagesPromiseBatch.push( pageToRequestPromise );
	}

	const settledRestPagesResults = await Promise.allSettled(
		restPagesPromiseBatch
	);

	const restPagesResults = settledRestPagesResults
		.filter( ( { status } ) => status === 'fulfilled' )
		// @ts-ignore
		.map( ( { value } ) => value );

	return [ ...firstPageResult, ...restPagesResults.flat( 1 ) ];
};

export default fetchAllMiddleware;
