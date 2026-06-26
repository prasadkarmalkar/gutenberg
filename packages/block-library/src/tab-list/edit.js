/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	store as blockEditorStore,
	RichText,
	__experimentalUseBorderProps as useBorderProps,
	__experimentalUseColorProps as useColorProps,
	__experimentalGetSpacingClassesAndStyles as getSpacingClassesAndStyles,
} from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { useSelect, useDispatch } from '@wordpress/data';
import { useCallback, useEffect, useRef } from '@wordpress/element';
import { ENTER } from '@wordpress/keycodes';

/**
 * Internal dependencies
 */
import AddTabToolbarControl from '../tab-panel/add-tab-toolbar-control';
import RemoveTabToolbarControl from '../tab-panel/remove-tab-toolbar-control';

const EMPTY_ARRAY = [];

function Edit( {
	attributes,
	clientId,
	context,
	__unstableLayoutClassNames: layoutClassNames,
} ) {
	const tabsList = context[ 'core/tabs-list' ] || EMPTY_ARRAY;

	const colorProps = useColorProps( attributes );
	const borderProps = useBorderProps( attributes );
	const spacingProps = getSpacingClassesAndStyles( attributes );

	const {
		tabsClientId,
		editorActiveTabIndex,
		activeTabIndex,
		tabPanelsClientId,
		tabCount,
	} = useSelect(
		( select ) => {
			const { getBlockRootClientId, getBlockAttributes, getBlocks } =
				select( blockEditorStore );

			const _tabsClientId = getBlockRootClientId( clientId );
			const tabsAttributes = _tabsClientId
				? getBlockAttributes( _tabsClientId )
				: {};

			const innerBlocks = _tabsClientId ? getBlocks( _tabsClientId ) : [];
			const tabPanels = innerBlocks.find(
				( b ) => b.name === 'core/tab-panels'
			);

			return {
				tabsClientId: _tabsClientId,
				editorActiveTabIndex: tabsAttributes?.editorActiveTabIndex,
				activeTabIndex: tabsAttributes?.activeTabIndex ?? 0,
				tabPanelsClientId: tabPanels?.clientId || null,
				tabCount: tabPanels?.innerBlocks?.length || 0,
			};
		},
		[ clientId ]
	);

	const effectiveActiveIndex = editorActiveTabIndex ?? activeTabIndex;

	const {
		__unstableMarkNextChangeAsNotPersistent,
		updateBlockAttributes,
		insertBlock,
	} = useDispatch( blockEditorStore );

	const handleTabClick = useCallback(
		( tabIndex ) => {
			if ( tabsClientId && tabIndex !== effectiveActiveIndex ) {
				__unstableMarkNextChangeAsNotPersistent();
				updateBlockAttributes( tabsClientId, {
					editorActiveTabIndex: tabIndex,
				} );
			}
		},
		[
			tabsClientId,
			effectiveActiveIndex,
			updateBlockAttributes,
			__unstableMarkNextChangeAsNotPersistent,
		]
	);

	const handleLabelChange = useCallback(
		( tabIndex, newLabel ) => {
			const tab = tabsList[ tabIndex ];
			if ( tab?.clientId ) {
				updateBlockAttributes( tab.clientId, { label: newLabel } );
			}
		},
		[ tabsList, updateBlockAttributes ]
	);

	const addTab = useCallback( () => {
		if ( ! tabPanelsClientId ) {
			return;
		}
		const newTabPanelBlock = createBlock( 'core/tab-panel', {
			label: __( 'Tab' ),
		} );
		insertBlock( newTabPanelBlock, undefined, tabPanelsClientId, false );
		__unstableMarkNextChangeAsNotPersistent();
		updateBlockAttributes( tabsClientId, {
			editorActiveTabIndex: tabCount,
		} );
	}, [
		tabPanelsClientId,
		tabCount,
		tabsClientId,
		insertBlock,
		updateBlockAttributes,
		__unstableMarkNextChangeAsNotPersistent,
	] );

	const addTabRef = useRef( addTab );
	useEffect( () => {
		addTabRef.current = addTab;
	}, [ addTab ] );

	const menuRef = useRef();
	const prevTabCountRef = useRef( tabsList.length );

	// When tabs are added or removed, focus the appropriate button.
	useEffect( () => {
		const prevCount = prevTabCountRef.current;
		prevTabCountRef.current = tabsList.length;

		if ( ! menuRef.current || tabsList.length === prevCount ) {
			return;
		}

		const focusButtonAt = ( index ) => {
			window.requestAnimationFrame( () => {
				const buttons = menuRef.current?.querySelectorAll( 'button' );
				const target = buttons?.[ index ];
				if ( ! target ) {
					return;
				}
				const richText = target.querySelector( '[contenteditable]' );
				if ( richText ) {
					richText.focus();
				} else {
					target.focus();
				}
			} );
		};

		focusButtonAt( effectiveActiveIndex );
	}, [ tabsList.length, effectiveActiveIndex ] );

	useEffect( () => {
		const el = menuRef.current;
		if ( ! el ) {
			return;
		}
		const onKeyDown = ( event ) => {
			if ( event.keyCode !== ENTER || event.defaultPrevented ) {
				return;
			}
			event.preventDefault();
			addTabRef.current();
		};
		// Capture phase so we intercept before RichText's own keydown handler.
		el.addEventListener( 'keydown', onKeyDown, true );
		return () => el.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );

	const blockProps = useBlockProps( {
		role: 'tablist',
		ref: menuRef,
		// Applied manually since this block has no inner blocks for the layout
		// support to add its container classes to.
		className: layoutClassNames,
	} );

	const buttonClassName = clsx( colorProps.className, borderProps.className );

	const buttonStyle = {
		...colorProps.style,
		...borderProps.style,
		...spacingProps.style,
	};

	return (
		<>
			<AddTabToolbarControl tabsClientId={ tabsClientId } />
			<RemoveTabToolbarControl tabsClientId={ tabsClientId } />
			<div { ...blockProps }>
				{ tabsList.map( ( tab, index ) => {
					const isActive = index === effectiveActiveIndex;
					return (
						<button
							key={ tab.clientId || index }
							type="button"
							role="tab"
							aria-selected={ isActive }
							className={ buttonClassName || undefined }
							style={ buttonStyle }
							tabIndex={ -1 }
							onClick={ ( event ) => {
								event.preventDefault();
								handleTabClick( index );
							} }
						>
							<RichText
								tagName="span"
								withoutInteractiveFormatting
								placeholder={ __( 'Tab title' ) }
								value={ tab.label }
								onChange={ ( newLabel ) =>
									handleLabelChange( index, newLabel )
								}
							/>
						</button>
					);
				} ) }
			</div>
		</>
	);
}

export default Edit;
