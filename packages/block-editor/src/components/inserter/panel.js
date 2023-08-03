/**
 * WordPress dependencies
 */
import { Icon } from '@wordpress/components';

/**
 * External dependencies
 */
import classNames from 'classnames';


function InserterPanel( { title, icon, removeRightPadding, children } ) {
	const blockEditorInserterPanelContentClassnames = classNames(
		'block-editor-inserter__panel-content',
		{
			'pr-0': removeRightPadding 
		}
	);

	return (
		<>
			<div className="block-editor-inserter__panel-header">
				<h2 className="block-editor-inserter__panel-title">
					{ title }
				</h2>
				<Icon icon={ icon } />
			</div>
			<div className={blockEditorInserterPanelContentClassnames}>
				{ children }
			</div>
		</>
	);
}

export default InserterPanel;
