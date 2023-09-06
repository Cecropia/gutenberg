// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-undef */

/**
 *
 * @param {RequestInit} options
 * @return {(url: string) => Promise<Response>} Response
 */
const createPageFetcher = ( options ) => {
	/**
	 *
	 * @param {string} url
	 * @return {Promise<Response>} Re
	 */
	return async ( url ) => {
		try {
			const pageResponse = await self.fetch( url, options );

			if ( ! pageResponse.ok ) {
				throw new Error( 'Response is not ok.' );
			}

			return await pageResponse.json();
		} catch ( error ) {
			throw error;
		}
	};
};

/**
 * Handles worker message events.
 *
 * @param {MessageEvent<{ firstPageResult: any[], pagesToRequest: string[], requestHeaders: [string, string][] }>} messageEvent
 */
async function handleMessage( { data } ) {
	try {
		const { firstPageResult, pagesToRequest, requestHeaders } = data;

		if ( ! firstPageResult || ! pagesToRequest || ! requestHeaders ) {
			throw new Error();
		}

		const pageFetcher = createPageFetcher( {
			headers: requestHeaders,
			method: 'GET',
		} );

		const restPagesToRequestPromises = pagesToRequest.map( pageFetcher );

		const settledRestPages = await Promise.allSettled(
			restPagesToRequestPromises
		);

		const restPagesResults = settledRestPages
			.filter( ( pageResult ) => pageResult.status === 'fulfilled' )
			// @ts-ignore
			.map( ( { value } ) => value );

		const successResponse = {
			type: 'data',
			message: [ ...firstPageResult, ...restPagesResults.flat( 1 ) ],
		};

		self.postMessage( successResponse );
	} catch ( error ) {
		self.postMessage( {
			type: 'error',
			message: 'Something went wrong while processing the message.',
		} );
	}
}

/**
 * Handles worker message error events.
 *
 */
function handleMessageError() {
	const errorResponse = {
		type: 'error',
		message: "The received message can't be deserialized.",
	};

	self.postMessage( errorResponse );
}

/**
 * Handles worker error events.
 *
 */
function handleError() {
	const errorResponse = {
		type: 'error',
		message: 'Something went wrong.',
	};

	self.postMessage( errorResponse );
}

self.addEventListener( 'message', handleMessage );

self.addEventListener( 'messageerror', handleMessageError );

self.addEventListener( 'error', handleError );
