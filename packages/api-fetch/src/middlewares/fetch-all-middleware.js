/**
 * WordPress dependencies
 */
import { addQueryArgs } from '@wordpress/url';
import { select } from '@wordpress/data';
import { store as customConfigStore } from '@wordpress/custom-config';

/**
 * Internal dependencies
 */
import apiFetch from '..';

/**
 * Web Worker for Fetch All Middleware.
 *
 * {@link https://webpack.js.org/guides/web-workers/}
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers}
 */
// eslint-disable-next-line no-undef
const worker = new Worker(
	new URL( '../workers/fetch-all-middleware.worker.js', import.meta.url ),
	{
		name: 'fetch-all-middleware-worker',
		type: 'module',
		credentials: 'same-origin',
	}
);

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
 * Number of items per page for fetchAllMiddleware.
 *
 * @type {number}
 */
const FETCH_ALL_MIDDLEWARE_ITEMS_PER_PAGE =
	select( customConfigStore ).getFetchAllMiddlewareConfig().itemsPerPage;

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
		per_page: FETCH_ALL_MIDDLEWARE_ITEMS_PER_PAGE,
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

	const workerWorkPromise = new Promise( ( resolve, reject ) => {
		/**
		 * Message Event for fetch-all-middleware worker
		 *
		 * @typedef {{type: "data", message: unknown[]} | {type: "error", message: unknown }} fetchAllMiddlewareMessageEvent
		 */

		/**
		 * Handles message events
		 *
		 * @param {MessageEvent<fetchAllMiddlewareMessageEvent>} message
		 */
		const handleMessage = ( { data } ) => {
			// Cleans worker events listeners
			worker.removeEventListener( 'message', handleMessage );
			worker.removeEventListener( 'messageerror', reject );
			worker.removeEventListener( 'error', reject );

			// Process message
			if ( data.type === 'error' ) {
				return reject( data.message );
			}

			resolve( data.message );
		};

		worker.addEventListener( 'message', handleMessage );
		worker.addEventListener( 'messageerror', reject );
		worker.addEventListener( 'error', reject );
	} );

	const totalPagesAvailable = getTotalPages( response ) ?? 0;

	// Calculate remaining pages to request.
	const remainingPagesToRequest = Math.max( totalPagesAvailable - 1, 0 );

	const pagesToRequest = Array.from(
		{ length: remainingPagesToRequest },
		( _, index ) => `${ initialQuery.url }&page=${ index + 2 }`
	);

	const requestHeaders = [ ...response.headers.entries() ];

	worker.postMessage( {
		firstPageResult,
		pagesToRequest,
		requestHeaders,
	} );

	return workerWorkPromise;
};

export default fetchAllMiddleware;
