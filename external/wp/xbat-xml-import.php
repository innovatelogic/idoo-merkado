<?php
/*
Plugin Name: XBat XML Import
Plugin URI:  https://xbat.com.ua/
Description: Imports products from XML feed manually via admin page or automatically via cron
Version:     1.2
Author:      YurG
Author URI:  https://xbat.com.ua/
License:     GPL2
*/

// -------------------------
// Admin menu
// -------------------------
add_action('admin_menu', function() {
    add_menu_page(
        'XBat XML Import',
        'XBat Import',
        'manage_options',
        'xbat-xml-import',
        'xbat_xml_import_page'
    );
});

// -------------------------
// Admin page content
// -------------------------
function xbat_xml_import_page() {
    echo '<div class="wrap">';
    echo '<h1>XBat XML Import</h1>';
    echo '<form method="post">';
    echo '<input type="hidden" name="xbat_run_import" value="1" />';
    submit_button('Run Import Now');
    echo '</form>';

    if (isset($_POST['xbat_run_import'])) {
        if (!class_exists('WooCommerce')) {
            echo '<p style="color:red;">WooCommerce is not active!</p>';
        } else {
            import_xbat_products_from_xml();
            echo '<p style="color:green;">Import finished!</p>';
        }
    }

    echo '</div>';
}

// -------------------------
// Schedule cron job on plugin activation
// -------------------------
register_activation_hook(__FILE__, function() {
    if (!wp_next_scheduled('xbat_hourly_import_event')) {
        // Schedule first run at next :30
        $first_run = strtotime(date('Y-m-d H:30:00'));
        if ($first_run < time()) {
            $first_run = strtotime('+1 hour', $first_run);
        }
        wp_schedule_event($first_run, 'hourly', 'xbat_hourly_import_event');
    }
});

// -------------------------
// Clear cron job on plugin deactivation
// -------------------------
register_deactivation_hook(__FILE__, function() {
    $timestamp = wp_next_scheduled('xbat_hourly_import_event');
    if ($timestamp) {
        wp_unschedule_event($timestamp, 'xbat_hourly_import_event');
    }
});

// -------------------------
// Cron event hook
// -------------------------
add_action('xbat_hourly_import_event', 'import_xbat_products_from_xml');

// -------------------------
// Main import function
// -------------------------
function import_xbat_products_from_xml() {
    
    error_log("XBAT IMPORT START");
    
    $xml_url = 'https://idoo-public.s3.eu-central-1.amazonaws.com/xbat/export/xbat-com-ua.xml';

    error_log("Loading XML from: " . $xml_url);
    
    // Load XML
    $xml_content = file_get_contents($xml_url);
    if (!$xml_content) {
        error_log("ERROR: XML could not be downloaded");    
        return;
    }
    
    error_log("XML downloaded, size: " . strlen($xml_content));

    $xml = simplexml_load_string($xml_content, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$xml) {
        error_log("ERROR: XML parsing failed");
        return;
    }

    error_log("XML parsed successfully");

    if (!isset($xml->shop)) {
        error_log("ERROR: <shop> node not found");
        return;
    }

    $shop = $xml->shop;

    if (!isset($shop->offers)) {
        error_log("ERROR: <offers> node not found");
        return;
    }

    $offers = $shop->offers->offer;

    error_log("Offers found: " . count($offers));

    foreach ($offers as $offer) {
        $product_id   = (string)$offer['id'];
        $product_name = (string)$offer->name;
        $price        = (float)$offer->price;
        $stock        = isset($offer->stock_quantity) ? (int)$offer->stock_quantity : 0;
        $description  = (string)$offer->description;
        $vendor       = (string)$offer->vendor;
        $category_id  = isset($offer->categoryId) ? (string)$offer->categoryId : '';

        error_log("Processing product: " . $product_id . " | " . $product_name);

        // Check if product exists
        $existing_product_id = wc_get_product_id_by_sku($product_id);

        if ($existing_product_id) {
            $product = wc_get_product($existing_product_id);
        } else {
            $product = new WC_Product_Simple();
            $product->set_sku($product_id);
        }

        $product->set_name($product_name);
        $product->set_regular_price($price);
        $product->set_description($description);
        $product->set_stock_quantity($stock);
        $product->set_manage_stock(true);
        $product->set_stock_status($stock > 0 ? 'instock' : 'outofstock');

        // Vendor attribute
        $taxonomy = 'pa_vendor';
        if (!taxonomy_exists($taxonomy)) {
            wc_create_attribute([
                'name' => 'Vendor',
                'slug' => 'vendor',
                'type' => 'select',
                'order_by' => 'menu_order',
                'has_archives' => false,
            ]);
        }
        wp_set_object_terms($product->get_id(), $vendor, $taxonomy, true);

        // Other attributes from <param>
        foreach ($offer->param as $param) {
            $attr_name  = sanitize_title((string)$param['name']);
            $attr_value = (string)$param;
            $taxonomy   = 'pa_' . $attr_name;

            if (!taxonomy_exists($taxonomy)) {
                wc_create_attribute([
                    'name' => (string)$param['name'],
                    'slug' => $attr_name,
                    'type' => 'select',
                    'order_by' => 'menu_order',
                    'has_archives' => false,
                ]);
            }

            wp_set_object_terms($product->get_id(), $attr_value, $taxonomy, true);
        }

        // -------------------------
        // Product images (prevent duplicates)
        // -------------------------
        
        $product_id_saved = $product->save();
        if (!$product_id_saved) {
            $product_id_saved = $product->get_id();
        }

        if ($category_id) {
            wp_set_object_terms($product_id_saved, (int)$category_id, 'product_cat');
        }

        if (isset($offer->price_rule)) {
            $fixed_price_rules = [];
        
            foreach ($offer->price_rule as $rule) {
                $min_qty = isset($rule['min']) ? (int)$rule['min'] : 1;
                $price   = (float)$rule;
        
                if ($min_qty > 0 && $price > 0) {
                    // Format expected by your plugin/meta:
                    // [min_qty => "price"]
                    $fixed_price_rules[$min_qty] = (string)(0 + $price);
                }
            }
        
            if (!empty($fixed_price_rules)) {
                ksort($fixed_price_rules, SORT_NUMERIC);
                update_post_meta($product_id_saved, '_fixed_price_rules', $fixed_price_rules);
            } else {
                delete_post_meta($product_id_saved, '_fixed_price_rules');
            }
        
            // Optional cleanup if old key was used before:
            delete_post_meta($product_id_saved, '_wc_tiered_price_table');
        }


        // 2) Populate images AFTER save
        $images = [];
        foreach ($offer->picture as $pic) {
            $images[] = (string)$pic;
        }

        if (!empty($images)) {
            $attachment_ids = [];

            foreach ($images as $image_url) {
                $existing_id = xbat_find_existing_image($image_url, $product_id_saved);
                $attachment_id = $existing_id ?: import_image_from_url($image_url, $product_id_saved);

                if ($attachment_id) {
                    $attachment_ids[] = (int)$attachment_id;
                }
            }

            $attachment_ids = array_values(array_unique($attachment_ids));

            if (!empty($attachment_ids)) {
                $featured_id = (int)$attachment_ids[0];
                $gallery_ids = array_slice($attachment_ids, 1); // exclude featured from gallery

                $product->set_image_id($featured_id);           // featured image
                $product->set_gallery_image_ids($gallery_ids);  // gallery only remaining images
                $product->save(); // persist image assignments
            }
        } 
    }

    error_log("XBAT IMPORT FINISHED");
}

function xbat_find_existing_image($image_url, $product_id) {
    $attachments = get_posts([
        'post_type'      => 'attachment',
        'posts_per_page' => 1,
        'post_parent'    => $product_id,
        'fields'         => 'ids',
        'meta_query'     => [
            [
                'key'     => '_xbat_source_image_url',
                'value'   => (string)$image_url,
                'compare' => '='
            ]
        ]
    ]);

    if (!empty($attachments)) {
        return (int)$attachments[0];
    }

    return false;
}

function import_image_from_url($image_url, $product_id) {
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    $tmp = download_url($image_url);
    if (is_wp_error($tmp)) return false;

    $file_array = [
        'name'     => basename(parse_url($image_url, PHP_URL_PATH)),
        'tmp_name' => $tmp
    ];

    $id = media_handle_sideload($file_array, $product_id);

    if (is_wp_error($id)) {
        @unlink($tmp);
        return false;
    }

    update_post_meta($id, '_xbat_source_image_url', (string)$image_url);

    return $id;
}