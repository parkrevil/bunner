use std::collections::HashMap;

fn validate_malformed_brackets(query: &str) -> Result<(), &'static str> {
    // Bracket는 key[]=value 형식으로만 허용
    // 그 외의 모든 bracket 사용은 거부

    if query.contains('[') || query.contains(']') {
        // Bracket가 있는 경우, key[]=value 형식인지 확인
        if !query.contains("[]") {
            // []가 없으면 malformed
            return Err("Invalid bracket syntax: only key[]=value format allowed");
        }

        // []가 있지만, 추가적인 bracket 문자가 있으면 malformed
        let bracket_count = query.chars().filter(|&c| c == '[' || c == ']').count();
        if bracket_count != 2 {
            return Err("Invalid bracket syntax: only one pair of [] allowed");
        }

        // [] 앞에 내용이 있어야 함 (key[]=value 형식이어야 함)
        if let Some(start) = query.find('[') {
            if start == 0 {
                return Err("Invalid bracket syntax: key required before []");
            }
        }
    }

    Ok(())
}

fn main() {
    let test_cases = vec![
        "a[=malformed",
        "[k]=v",
        "[]=v",
        "a[]]=v",
        "a[[x]]=v",
    ];

    for test_case in test_cases {
        println!("Testing: {}", test_case);
        match validate_malformed_brackets(test_case) {
            Ok(_) => println!("  Result: OK (should be ERROR)"),
            Err(e) => println!("  Result: ERROR - {}", e),
        }
        println!();
    }
}