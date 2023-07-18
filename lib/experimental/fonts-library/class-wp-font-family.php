<?php
/**
 * Fonts Library Family class.
 *
 * This file contains functions and definitions for the Gutenberg Fonts Library.
 *
 * @package    Gutenberg
 * @subpackage Fonts Library
 * @since      X.X.X
 */

/**
 * Fonts Library class.
 */
class WP_Font_Family {

	const ALLOWED_FONT_MIME_TYPES = array(
		'otf'   => 'font/otf',
		'ttf'   => 'font/ttf',
		'woff'  => 'font/woff',
		'woff2' => 'font/woff2',
	);

	/**
	 * Font family data
	 *
	 * @var array
	 */
	private $data;
	/**
	 * Relative path to the fonts directory.
	 *
	 * @var string
	 */
	private $relative_fonts_path;

	/**
	 * WP_Font_Family constructor.
	 *
	 * @param array $font_family Font family data.
	 */
	public function __construct( $font_family = array() ) {
		$this->data                = $font_family;
		$this->relative_fonts_path = content_url( '/fonts/' );
	}

	/**
	 * Returns the font family data.
	 *
	 * @return array An array in fontFamily theme.json format.
	 */
	public function get_data() {
		return $this->data;
	}

	/**
	 * Returns the font family data.
	 *
	 * @return string fontFamily in theme.json format as stringified JSON.
	 */
	public function get_data_as_json() {
		return wp_json_encode( $this->get_data() );
	}

	/**
	 * Returns if the font family has font faces defined.
	 *
	 * @return bool true if the font family has font faces defined, false otherwise.
	 */
	public function has_font_faces() {
		return (
			isset( $this->data['fontFace'] )
			&& is_array( $this->data['fontFace'] )
			&& ! empty( $this->data['fontFace'] )
		);
	}

	/**
	 * Returns the absolute path to the fonts directory.
	 *
	 * @return string Path to the fonts directory.
	 */
	static public function get_fonts_directory() {
		return path_join( WP_CONTENT_DIR, 'fonts' );
	}

	/**
	 * Define WP_FONTS_DIR constant to make it available to the rest of the code.
	 */
	static public function define_fonts_directory() {
		define( 'WP_FONTS_DIR', self::get_fonts_directory() );
	}

	/**
	 * Returns whether the given file has a font MIME type.
	 *
	 * @param string $filepath The file to check.
	 * @return bool True if the file has a font MIME type, false otherwise.
	 */
	static private function has_font_mime_type( $filepath ) {
		$filetype = wp_check_filetype( $filepath, self::ALLOWED_FONT_MIME_TYPES );
		return in_array( $filetype['type'], self::ALLOWED_FONT_MIME_TYPES, true );
	}

	/**
	 * Removes font family assets.
	 *
	 * @return bool True if assets were removed, false otherwise.
	 */
	private function remove_font_family_assets() {
		if ( $this->has_font_faces() ) {
			foreach ( $this->data['fontFace'] as $font_face ) {
				$were_assets_removed = $this->delete_font_face_assets( $font_face );
				if ( false === $were_assets_removed ) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Removes a font family from the database and deletes its assets.
	 *
	 * @return bool|WP_Error True if the font family was uninstalled, WP_Error otherwise.
	 */
	public function uninstall() {
		$post = $this->get_data_from_post();
		if ( null === $post ) {
			return new WP_Error( 'font_family_not_found', __( 'The font family could not be found.', 'gutenberg' ) );
		}
		$were_assets_removed = $this->remove_font_family_assets();
		if ( true === $were_assets_removed ) {
			$was_post_deleted = wp_delete_post( $post->ID, true );
			if ( null === $was_post_deleted ) {
				return new WP_Error( 'font_family_not_deleted', __( 'The font family could not be deleted.', 'gutenberg' ) );
			}
		}
		return true;
	}

	/**
	 * Deletes a specified font asset file from the fonts directory.
	 *
	 * @param string $src The path of the font asset file to delete.
	 * @return bool Whether the file was deleted.
	 */
	static private function delete_asset( $src ) {
		$filename  = basename( $src );
		$file_path = path_join( WP_FONTS_DIR, $filename );

		if ( ! file_exists( $file_path ) ) {
			return false;
		}
		wp_delete_file( $file_path );

		// If the file still exists after trying to delete it, return false.
		if ( file_exists( $file_path ) ) {
			return false;
		}

		// return true if the file was deleted.
		return true;
	}

	/**
	 * Deletes all font face asset files associated with a given font face.
	 *
	 * @param array $font_face The font face array containing the 'src' attribute with the file path(s) to be deleted.
	 */
	static private function delete_font_face_assets( $font_face ) {
		$srcs = ! empty( $font_face['src'] ) && is_array( $font_face['src'] )
			? $font_face['src']
			: array( $font_face['src'] );
		foreach ( $srcs as $src ) {
			$was_asset_removed = self::delete_asset( $src );
			if ( ! $was_asset_removed ) {
				// Bail if any of the assets could not be removed.
				return false;
			}
		}
		return true;
	}

	/**
	 * Downloads a font asset.
	 *
	 * Downloads a font asset from a specified source URL and saves it to the font directory.
	 *
	 * @param string $src The source URL of the font asset to be downloaded.
	 * @param string $filename The filename to save the downloaded font asset as.
	 * @return string|bool The relative path to the downloaded font asset. False if the download failed.
	 */
	private function download_asset( $src, $filename ) {
		$file_path = path_join( WP_FONTS_DIR, $filename );

		// Checks if the file to be downloaded has a font mime type.
		if ( ! self::has_font_mime_type( $file_path ) ) {
			return false;
		}

		// Include file with download_url() if function doesn't exist.
		if ( ! function_exists( 'download_url' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		// Downloads the font asset or returns false.
		$temp_file = download_url( $src );
		if ( is_wp_error( $temp_file ) ) {
			@unlink( $temp_file );
			return false;
		}

		// Moves the file to the fonts directory or return false.
		$renamed_file = rename( $temp_file, $file_path );
		// Cleans the temp file.
		@unlink( $temp_file );

		if ( ! $renamed_file ) {
			return false;
		}

		// Returns the relative path to the downloaded font asset to be used as font face src.
		return "{$this->relative_fonts_path}{$filename}";
	}

	/**
	 * Merges two fonts and their font faces.
	 *
	 * @param array $font1 The first font to merge.
	 * @param array $font2 The second font to merge.
	 *
	 * @return array The merged font.
	 */
	static private function merge_fonts( $font1, $font2 ) {
		$font_faces_1      = isset( $font1['fontFace'] ) ? $font1['fontFace'] : array();
		$font_faces_2      = isset( $font2['fontFace'] ) ? $font2['fontFace'] : array();
		$merged_font_faces = array_merge( $font_faces_1, $font_faces_2 );

		$serialized_faces        = array_map( 'serialize', $merged_font_faces );
		$unique_serialized_faces = array_unique( $serialized_faces );
		$unique_faces            = array_map( 'unserialize', $unique_serialized_faces );

		$merged_font             = array_merge( $font1, $font2 );
		$merged_font['fontFace'] = $unique_faces;

		return $merged_font;
	}

	/**
	 * Move an uploaded font face asset from temp folder to the wp fonts directory.
	 *
	 * This is used when uploading local fonts.
	 *
	 * @param array $font_face Font face to download.
	 * @param array $file Uploaded file.
	 * @return array New font face with all assets downloaded and referenced in the font face definition.
	 */
	private function move_font_face_asset( $font_face, $file ) {
		$new_font_face = $font_face;
		$filename      = self::get_filename_from_font_face( $font_face, $file['name'] );
		$filepath      = path_join( WP_FONTS_DIR, $filename );

		// Remove the uploaded font asset reference from the font face definition because it is no longer needed.
		unset( $new_font_face['file'] );

		// If the filepath has not a font mime type, we don't move the file and return the font face definition without src to be ignored later.
		if ( ! self::has_font_mime_type( $filepath ) ) {
			return $new_font_face;
		}

		// Move the uploaded font asset from the temp folder to the wp fonts directory.
		$file_was_moved = move_uploaded_file( $file['tmp_name'], $filepath );

		if ( $file_was_moved ) {
			// If the file was successfully moved, we update the font face definition to reference the new file location.
			$new_font_face['src'] = "{$this->relative_fonts_path}{$filename}";
		}

		return $new_font_face;
	}

	/**
	 * Sanitizes the font family data using WP_Theme_JSON.
	 *
	 * @return array A sanitized font family defintion.
	 */
	private function sanitize() {
		// Creates the structure of theme.json array with the new fonts.
		$fonts_json = array(
			'version'  => '2',
			'settings' => array(
				'typography' => array(
					'fontFamilies' => array( $this->data ),
				),
			),
		);
		// Creates a new WP_Theme_JSON object with the new fonts to mmake profit of the sanitization and validation.
		$theme_json     = new WP_Theme_JSON( $fonts_json );
		$theme_data     = $theme_json->get_data();
		$sanitized_font = ! empty( $theme_data['settings']['typography']['fontFamilies'] )
			? $theme_data['settings']['typography']['fontFamilies'][0]
			: array();
		$this->data     = $sanitized_font;
		return $this->data;
	}

	/**
	 * Generates a filename for a font face asset.
	 *
	 * Creates a filename for a font face asset using font family, style, weight and extension information.
	 *
	 * @param array  $font_face The font face array containing 'fontFamily', 'fontStyle', and 'fontWeight' attributes.
	 * @param string $url The URL of the font face asset, used to derive the file extension.
	 * @param int    $i Optional counter for appending to the filename, default is 1.
	 * @return string The generated filename for the font face asset.
	 */
	static private function get_filename_from_font_face( $font_face, $url, $i = 1 ) {
		$extension = pathinfo( $url, PATHINFO_EXTENSION );
		$family    = sanitize_title( $font_face['fontFamily'] );
		$style     = sanitize_title( $font_face['fontStyle'] );
		$weight    = sanitize_title( $font_face['fontWeight'] );
		$filename  = "{$family}_{$style}_{$weight}";
		if ( $i > 1 ) {
			$filename .= "_{$i}";
		}
		return "{$filename}.{$extension}";
	}

	/**
	 * Downloads font face assets.
	 *
	 * Downloads the font face asset(s) associated with a font face. It works with both single
	 * source URLs and arrays of multiple source URLs.
	 *
	 * @param array $font_face The font face array containing the 'src' attribute with the source URL(s) of the assets.
	 * @return array The modified font face array with the new source URL(s) to the downloaded assets.
	 */
	private function download_font_face_assets( $font_face ) {
		$new_font_face        = $font_face;
		$srcs                 = ! empty( $font_face['src'] ) && is_array( $font_face['src'] )
			? $font_face['src']
			: array( $font_face['src'] );
		$new_font_face['src'] = array();
		$i                    = 0;
		foreach ( $srcs as $src ) {
			$filename = self::get_filename_from_font_face( $font_face, $src, $i++ );
			$new_src  = $this->download_asset( $src, $filename );
			if ( $new_src ) {
				$new_font_face['src'][] = $new_src;
			}
		}
		if ( count( $new_font_face['src'] ) === 1 ) {
			$new_font_face['src'] = $new_font_face['src'][0];
		}
		return $new_font_face;
	}


	/**
	 * Downloads font face assets if the font family is a Google font, or moves them if it is a local font.
	 *
	 * @param array $files An array of files to be installed.
	 * @return bool|WP_Error
	 */
	public function download_or_move_font_faces( $files ) {
		if ( $this->has_font_faces() ) {
			$new_font_faces = array();
			foreach ( $this->data['fontFace'] as $font_face ) {
				if ( empty( $files ) ) {
					// If we are installing local fonts, we need to move the font face assets from the temp folder to the wp fonts directory.
					$new_font_face = $this->download_font_face_assets( $font_face );
				} else {
					// If we are installing google fonts, we need to download the font face assets.
					$new_font_face = $this->move_font_face_asset( $font_face, $files[ $font_face['file'] ] );
				}
				// If the font face assets were successfully downloaded, we add the font face to the new font.
				// Font faces with failed downloads are not added to the new font.
				if ( ! empty( $new_font_face['src'] ) ) {
					$new_font_faces[] = $new_font_face;
				}
			}
			if ( ! empty( $new_font_faces ) ) {
				$this->data['fontFace'] = $new_font_faces;
				return true;
			}
			return WP_Error( 'font_face_download_failed', __( 'The font face assets could not be written.', 'gutenberg' ) );
		}
		return true;
	}

	/**
	 * Get the post for a font family.
	 *
	 * @return WP_Post|null The post for this font family object or null if the post does not exist.
	 */
	private function get_font_post() {
		$args = array(
			'post_type'      => 'wp_fonts_library',
			'post_name'      => $this->data['slug'],
			'name'           => $this->data['slug'],
			'posts_per_page' => 1,
		);

		$posts_query = new WP_Query( $args );

		if ( $posts_query->have_posts() ) {
			$post = $posts_query->posts[0];
			return $post;
		}

		return null;
	}

	/**
	 * Get the data for this object from the database and set it to the data property.
	 *
	 * @return WP_Post|null The post for this font family object or null if the post does not exist.
	 */
	private function get_data_from_post() {
		$post = $this->get_font_post();
		if ( $post ) {
			$data       = json_decode( $post->post_content, true );
			$this->data = $data;
			return $post;
		}
		return null;
	}

	/**
	 * Create a post for a font family.
	 *
	 * @return int
	 */
	private function create_font_post() {
		$post    = array(
			'post_title'   => $this->data['name'],
			'post_name'    => $this->data['slug'],
			'post_type'    => 'wp_fonts_library',
			'post_content' => $this->get_data_as_json(),
			'post_status'  => 'publish',
		);
		$post_id = wp_insert_post( $post );
		if ( 0 === $post_id ) {
			return WP_Error( 'font_post_creation_failed', __( 'Font post creation failed', 'gutenberg' ) );
		}
		return $post_id;
	}

	/**
	 * Update a post for a font family.
	 *
	 * @param WP_Post $post The post to update.
	 * @return int
	 */
	private function update_font_post( $post ) {
		$post_font_data = json_decode( $post->post_content, true );
		$new_data       = $this->merge_fonts( $post_font_data, $this->data );
		$this->data     = $new_data;

		$post = array(
			'ID'           => $post->ID,
			'post_content' => $this->get_data_as_json(),
		);

		$post_id = wp_update_post( $post );
		return $post_id;
	}

	/**
	 * Creates a post for a font in the fonts library if it doesn't exist, or updates it if it does.
	 *
	 * @return WP_Post
	 */
	public function create_or_update_font_post() {
		$post = $this->get_font_post();
		if ( $post ) {
			return $this->update_font_post( $post );
		}
		return $this->create_font_post();
	}

	/**
	 * Install the font family into the library
	 *
	 * @param array $files Array of font files to be installed.
	 *
	 * @return WP_Post|WP_Error
	 */
	public function install( $files = null ) {
		$were_assets_written = $this->download_or_move_font_faces( $files );
		if ( $were_assets_written ) {
			$post_id = $this->create_or_update_font_post();
			if ( $post_id ) {
				return $this->get_data();
			}
			return WP_Error( 'font_post_creation_failed', __( 'Font post creation failed', 'gutenberg' ) );
		}
		return WP_Error( 'font_face_download_failed', __( 'The font face assets could not be written.', 'gutenberg' ) );
	}

}

add_action( 'init', array( 'WP_Font_Family', 'define_fonts_directory' ) );
