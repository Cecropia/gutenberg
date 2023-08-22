/**
 * WordPress dependencies
 */
import { combineReducers } from '@wordpress/data';

export function fetchAllMiddlewareConfig(
	state = {
		itemsPerPage: 100,
	},
	_action: unknown
) {
	return state;
}

export function saveEntityRecordConfig(
	state = {
		refreshEntityRecordsDebounceTime: 10000,
	},
	_action: unknown
) {
	return state;
}

export default combineReducers( {
	fetchAllMiddlewareConfig,
	saveEntityRecordConfig,
} );
