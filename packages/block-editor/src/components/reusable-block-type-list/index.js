/**
 * WordPress dependencies
 */
import { getBlockMenuDefaultClassName } from '@wordpress/blocks';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import InserterListItem from '../inserter-list-item';
import { InserterListboxGroup, InserterListboxRow } from '../inserter-listbox';

/**
 * External dependencies
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { FixedSizeGrid as Grid } from 'react-window';
// eslint-disable-next-line import/no-extraneous-dependencies
import AutoSizer from 'react-virtualized-auto-sizer';

function chunk( array, size ) {
	const chunks = [];
	for ( let i = 0, j = array.length; i < j; i += size ) {
		chunks.push( array.slice( i, i + size ) );
	}
	return chunks;
}

const COLUMN_COUNT = 3;
const COLUMN_WIDTH = 95;
const ROW_HEIGHT = 105;

function ReusableBlockTypeList( {
	items = [],
	onSelect,
	onHover = () => {},
	children,
	label,
	isDraggable = true,
} ) {
	const threeColumnItems = useMemo( () => chunk( items, 3 ), [ items ] );

	const rowCount =
		items.length === 0 ? 0 : Math.ceil( items.length / COLUMN_COUNT );

	const itemRenderer = ( { rowIndex, columnIndex, style } ) => {
		const item = threeColumnItems[ rowIndex ][ columnIndex ];

		if ( ! item ) {
			return null;
		}

		return (
			<InserterListItem
				key={ item.id }
				item={ item }
				className={ getBlockMenuDefaultClassName( item.id ) }
				onSelect={ onSelect }
				onHover={ onHover }
				isDraggable={ isDraggable }
				isFirst={ rowIndex === 0 && columnIndex === 0 }
				style={ style }
			/>
		);
	};

	return (
		<InserterListboxGroup
			className="block-editor-reusable-block-type-list"
			aria-label={ label }
		>
			<AutoSizer>
				{ ( { height: autoSizeHeight, width: autoSizerWidth } ) => (
					<InserterListboxRow>
						<Grid
							height={ autoSizeHeight }
							width={ autoSizerWidth }
							columnCount={ COLUMN_COUNT }
							columnWidth={ COLUMN_WIDTH }
							rowCount={ rowCount }
							rowHeight={ ROW_HEIGHT }
						>
							{ itemRenderer }
						</Grid>
					</InserterListboxRow>
				) }
			</AutoSizer>

			{ children }
		</InserterListboxGroup>
	);
}

export default ReusableBlockTypeList;
