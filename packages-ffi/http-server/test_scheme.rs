use uriparse::URI;

fn main() {
    let uri = URI::try_from("http://example.com").unwrap();
    let scheme = uri.scheme();
    println!("Scheme type: {:?}", std::any::type_name::<_>(&scheme));
    println!("Scheme value: {:?}", scheme);
}
